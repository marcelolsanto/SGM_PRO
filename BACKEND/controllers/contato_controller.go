package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/smtp"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"workspace/backend/config"
	"workspace/backend/models"

	"github.com/gofiber/fiber/v2"
)

type ContatoPayload struct {
	Tipo     string `json:"tipo"`
	Nome     string `json:"nome"`
	Empresa  string `json:"empresa"`
	Email    string `json:"email"`
	Telefone string `json:"telefone"`
	Cidade   string `json:"cidade"`
	Mensagem string `json:"mensagem"`
}

func EnviarContato(c *fiber.Ctx) error {
	var payload ContatoPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"sucesso": false, "erro": "Dados inválidos"})
	}

	payload.Nome = strings.TrimSpace(payload.Nome)
	payload.Email = strings.TrimSpace(payload.Email)
	payload.Telefone = strings.TrimSpace(payload.Telefone)
	payload.Empresa = strings.TrimSpace(payload.Empresa)
	payload.Cidade = strings.TrimSpace(payload.Cidade)
	payload.Mensagem = strings.TrimSpace(payload.Mensagem)

	if payload.Nome == "" || payload.Email == "" {
		return c.Status(400).JSON(fiber.Map{
			"sucesso": false,
			"erro":    "Nome e E-mail são obrigatórios.",
		})
	}

	if payload.Tipo == "" {
		payload.Tipo = "empresa"
	}

	// 1. Salva no banco de dados PostgreSQL
	lead := models.ContatoLead{
		Tipo:     payload.Tipo,
		Nome:     payload.Nome,
		Empresa:  payload.Empresa,
		Email:    payload.Email,
		Telefone: payload.Telefone,
		Cidade:   payload.Cidade,
		Mensagem: payload.Mensagem,
		Status:   "NOVO",
	}
	config.DB.Create(&lead)

	// 2. Monta texto do WhatsApp com formatação
	whatsappNumero := os.Getenv("CONTACT_WHATSAPP_NUMBER")
	if whatsappNumero == "" {
		whatsappNumero = "5511972980409"
	}

	var textoWA string
	if payload.Tipo == "medidor" {
		textoWA = "Olá Marcelo!\n\nMe chamo *" + payload.Nome + "* e tenho interesse em me credenciar como *Medidor Técnico Parceiro* no SGM.PRO.\n\n• *Especialidade:* " + payload.Empresa + "\n• *Telefone:* " + payload.Telefone + "\n• *E-mail:* " + payload.Email + "\n• *Cidade/UF:* " + payload.Cidade + "\n• *Mensagem:* " + payload.Mensagem
	} else {
		textoWA = "Olá Marcelo!\n\nMe chamo *" + payload.Nome + "* da empresa *" + payload.Empresa + "* e gostaria de agendar uma apresentação dos serviços de medição terceirizada do *SGM.PRO*.\n\n• *Telefone:* " + payload.Telefone + "\n• *E-mail:* " + payload.Email + "\n• *Cidade/UF:* " + payload.Cidade + "\n• *Mensagem/Volume:* " + payload.Mensagem
	}
	whatsappURL := fmt.Sprintf("https://wa.me/%s?text=%s", whatsappNumero, url.QueryEscape(textoWA))

	// 3. Disparo assíncrono dos e-mails com fallback
	// a) Notificação para a equipe interna / administradores do SGM.PRO
	go dispararEmailContato(payload, lead.ID)
	// b) Confirmação automática para o cliente que enviou o formulário
	go dispararConfirmacaoCliente(payload, lead.ID)

	return c.Status(200).JSON(fiber.Map{
		"sucesso":      true,
		"mensagem":     "Solicitação registrada com sucesso! Nossa equipe entrará em contato em breve.",
		"whatsapp_url": whatsappURL,
		"lead_id":      lead.ID,
	})
}

func ListarLeadsContato(c *fiber.Ctx) error {
	var leads []models.ContatoLead
	tipo := c.Query("tipo")
	q := config.DB.Order("criado_em DESC")
	if tipo != "" && tipo != "TODOS" {
		q = q.Where("tipo = ?", tipo)
	}
	q.Limit(100).Find(&leads)
	return c.Status(200).JSON(leads)
}

func dispararEmailContato(p ContatoPayload, leadID uint) {
	logMsg := func(formato string, v ...interface{}) {
		txt := fmt.Sprintf("[%s] "+formato, append([]interface{}{time.Now().Format("2006-01-02 15:04:05")}, v...)...)
		fmt.Println(txt)
		log.Println(txt)
		// Registra em arquivo local de log para auditoria de contatos
		if f, err := os.OpenFile("contato.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
			f.WriteString(txt + "\n")
			f.Close()
		}
	}

	logMsg("📧 [DISPARO INICIADO] Processando lead #%d (%s - %s)", leadID, p.Nome, p.Empresa)

	destinatariosStr := strings.Trim(strings.TrimSpace(os.Getenv("CONTACT_RECIPIENT_EMAIL")), "\"'")
	if destinatariosStr == "" {
		destinatariosStr = "marcelo.lima@telebras.com.br, marcelolsantos30@gmail.com, marcelo.lsantos@bandtec.com.br"
	}

	var destinatarios []string
	for _, d := range strings.Split(destinatariosStr, ",") {
		d = strings.Trim(strings.TrimSpace(d), "\"'")
		if d != "" {
			destinatarios = append(destinatarios, d)
		}
	}
	if len(destinatarios) == 0 {
		destinatarios = []string{"marcelo.lsantos@bandtec.com.br"}
	}

	labelTipo := "Empresa / Loja de Planejados"
	labelEmpresa := "Nome da Loja / Marcenaria"
	if p.Tipo == "medidor" {
		labelTipo = "Medidor Técnico Profissional"
		labelEmpresa = "Especialidade / Perfil"
	}

	reDigitos := regexp.MustCompile(`[^0-9]`)
	telLimpo := reDigitos.ReplaceAllString(p.Telefone, "")

	assunto := fmt.Sprintf("[SGM.PRO] Novo Lead #%d: %s (%s)", leadID, p.Nome, p.Empresa)

	corpoTxt := fmt.Sprintf("NOVO CONTATO RECEBIDO NO SGM.PRO (Lead #%d)\n\nTipo de Perfil: %s\nNome: %s\n%s: %s\nE-mail: %s\nTelefone/WhatsApp: %s\nCidade/UF: %s\n\nMensagem / Detalhes:\n%s\n\nEnviado automaticamente pelo portal SGM.PRO",
		leadID, labelTipo, p.Nome, labelEmpresa, p.Empresa, p.Email, p.Telefone, p.Cidade, p.Mensagem)

	corpoHTML := fmt.Sprintf(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #1d4ed8, #0284c7); padding: 26px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 900; color: #ffffff; }
    .badge { display: inline-block; padding: 4px 12px; font-size: 11px; font-weight: 800; border-radius: 9999px; background: #38bdf8; color: #082f49; text-transform: uppercase; margin-top: 8px; }
    .content { padding: 26px; }
    .field { margin-bottom: 14px; border-bottom: 1px solid #1e293b; padding-bottom: 10px; }
    .label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { font-size: 14px; font-weight: 700; color: #ffffff; margin-top: 3px; }
    .msg-box { background: #020617; border: 1px solid #1e293b; border-radius: 12px; padding: 14px; font-size: 13px; line-height: 1.5; color: #cbd5e1; margin-top: 14px; }
    .cta { display: block; text-align: center; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 800; font-size: 13px; margin-top: 20px; }
    .footer { background: #020617; padding: 14px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🚀 Novo Lead Recebido • SGM.PRO</h1>
      <span class="badge">%s</span>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Nome do Solicitante</div>
        <div class="value">%s</div>
      </div>
      <div class="field">
        <div class="label">%s</div>
        <div class="value">%s</div>
      </div>
      <div class="field">
        <div class="label">E-mail</div>
        <div class="value"><a href="mailto:%s" style="color: #38bdf8;">%s</a></div>
      </div>
      <div class="field">
        <div class="label">Telefone / WhatsApp</div>
        <div class="value"><a href="https://wa.me/%s" style="color: #34d399;">%s</a></div>
      </div>
      <div class="field">
        <div class="label">Cidade / UF</div>
        <div class="value">%s</div>
      </div>
      <div class="label" style="margin-top: 14px;">Mensagem / Requisitos:</div>
      <div class="msg-box">%s</div>
      <a href="mailto:%s?subject=Apresentacao%%20SGM.PRO" class="cta">Responder por E-mail</a>
    </div>
    <div class="footer">
      SGM.PRO — Plataforma Oficial de Medição Técnica Terceirizada
    </div>
  </div>
</body>
</html>`, labelTipo, p.Nome, labelEmpresa, p.Empresa, p.Email, p.Email, telLimpo, p.Telefone, p.Cidade, p.Mensagem, p.Email)

	// 1. Tenta envio via Resend API (HTTPS)
	rawResendKey := os.Getenv("RESEND_API_KEY")
	resendKey := strings.Trim(strings.TrimSpace(rawResendKey), "\"'")
	enviado := false

	if resendKey != "" {
		resendFrom := strings.Trim(strings.TrimSpace(os.Getenv("RESEND_FROM_EMAIL")), "\"'")
		if resendFrom == "" {
			resendFrom = "SGM.PRO <onboarding@resend.dev>"
		}

		payloadResend := map[string]interface{}{
			"from":     resendFrom,
			"to":       destinatarios,
			"reply_to": p.Email,
			"subject":  assunto,
			"html":     corpoHTML,
			"text":     corpoTxt,
		}

		bodyBytes, _ := json.Marshal(payloadResend)
		reqHttp, errReq := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(bodyBytes))
		if errReq == nil {
			reqHttp.Header.Set("Authorization", "Bearer "+resendKey)
			reqHttp.Header.Set("Content-Type", "application/json")
			client := &http.Client{Timeout: 10 * time.Second}
			respHttp, errResp := client.Do(reqHttp)
			if errResp == nil {
				respBytes, _ := io.ReadAll(respHttp.Body)
				respHttp.Body.Close()

				if respHttp.StatusCode == 200 || respHttp.StatusCode == 201 {
					logMsg("✅ [SGM.PRO] E-mail de lead '%s' entregue com sucesso via Resend para %v (Resposta: %s)", p.Nome, destinatarios, string(respBytes))
					enviado = true
				} else if respHttp.StatusCode == 403 {
					// Fallback de Sandbox do Resend: só aceita marcelo.lsantos@bandtec.com.br até verificar domínio
					logMsg("⚠️ Resend 403 (Sandbox de teste). Redirecionando para marcelo.lsantos@bandtec.com.br... Resposta: %s", string(respBytes))
					payloadResend["to"] = []string{"marcelo.lsantos@bandtec.com.br"}
					payloadResend["from"] = "SGM.PRO <onboarding@resend.dev>"
					retryBody, _ := json.Marshal(payloadResend)
					reqRetry, _ := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(retryBody))
					reqRetry.Header.Set("Authorization", "Bearer "+resendKey)
					reqRetry.Header.Set("Content-Type", "application/json")
					respRetry, errRetry := client.Do(reqRetry)
					if errRetry == nil {
						retryBytes, _ := io.ReadAll(respRetry.Body)
						respRetry.Body.Close()
						if respRetry.StatusCode == 200 || respRetry.StatusCode == 201 {
							logMsg("✅ [SGM.PRO] E-mail entregue com sucesso no Resend para marcelo.lsantos@bandtec.com.br: %s", string(retryBytes))
							enviado = true
						} else {
							logMsg("❌ Erro no envio Resend fallback: HTTP %d - %s", respRetry.StatusCode, string(retryBytes))
						}
					} else {
						logMsg("❌ Erro HTTP ao conectar no Resend: %v", errRetry)
					}
				} else {
					logMsg("❌ Erro inesperado Resend HTTP %d: %s", respHttp.StatusCode, string(respBytes))
				}
			} else {
				logMsg("❌ Falha na requisição HTTPS ao Resend: %v", errResp)
			}
		}
	}

	// 2. Fallback para SMTP Gmail padrão
	if !enviado {
		smtpHost := strings.Trim(strings.TrimSpace(os.Getenv("EMAIL_HOST")), "\"'")
		smtpPort := strings.Trim(strings.TrimSpace(os.Getenv("EMAIL_PORT")), "\"'")
		smtpUser := strings.Trim(strings.TrimSpace(os.Getenv("EMAIL_HOST_USER")), "\"'")
		smtpPass := strings.Trim(strings.TrimSpace(os.Getenv("EMAIL_HOST_PASSWORD")), "\"'")
		smtpPass = strings.ReplaceAll(smtpPass, " ", "")

		if smtpHost != "" && smtpPort != "" && smtpUser != "" && smtpPass != "" {
			fromEmail := strings.Trim(strings.TrimSpace(os.Getenv("DEFAULT_FROM_EMAIL")), "\"'")
			if fromEmail == "" {
				fromEmail = smtpUser
			}
			msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nReply-To: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
				fromEmail, strings.Join(destinatarios, ", "), p.Email, assunto, corpoHTML))

			auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
			addr := fmt.Sprintf("%s:%s", smtpHost, smtpPort)
			if errSmtp := smtp.SendMail(addr, auth, fromEmail, destinatarios, msg); errSmtp == nil {
				logMsg("✅ [SGM.PRO] E-mail de lead '%s' enviado com sucesso via SMTP Gmail para %v", p.Nome, destinatarios)
				enviado = true
			} else {
				logMsg("⚠️ Falha no envio via SMTP Gmail: %v", errSmtp)
			}
		}
	}

	if !enviado {
		logMsg("ℹ️ [SGM.PRO LEAD REGISTRADO NO BANCO] Nome: %s | Empresa: %s | Tel: %s | Email: %s", p.Nome, p.Empresa, p.Telefone, p.Email)
	}
}

func dispararConfirmacaoCliente(p ContatoPayload, leadID uint) {
	logMsg := func(formato string, v ...interface{}) {
		txt := fmt.Sprintf("[%s] "+formato, append([]interface{}{time.Now().Format("2006-01-02 15:04:05")}, v...)...)
		fmt.Println(txt)
		log.Println(txt)
		if f, err := os.OpenFile("contato.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
			f.WriteString(txt + "\n")
			f.Close()
		}
	}

	if p.Email == "" {
		return
	}

	logMsg("📨 [AUTO-RESPOSTA CLIENTE] Enviando confirmação para o cliente: %s (%s)", p.Nome, p.Email)

	assunto := "Recebemos seu contato com sucesso! • SGM.PRO"

	corpoTxt := fmt.Sprintf("Olá, %s!\n\nAgradecemos o seu contato com o SGM.PRO.\n\nRecebemos suas informações com sucesso (Protocolo #%d) e nossa equipe comercial já está analisando seus dados para agendar uma apresentação e tirar todas as suas dúvidas.\n\nDados registrados:\n• Nome: %s\n• Empresa/Perfil: %s\n• Telefone: %s\n• Cidade/UF: %s\n\nCaso prefira atendimento imediato, você pode falar conosco pelo WhatsApp: +55 (11) 97298-0409\n\nAtenciosamente,\nEquipe SGM.PRO — Plataforma de Medição Técnica Terceirizada\nhttps://sgmpro.com.br",
		p.Nome, leadID, p.Nome, p.Empresa, p.Telefone, p.Cidade)

	corpoHTML := fmt.Sprintf(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #1d4ed8, #0284c7); padding: 30px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; }
    .header p { margin: 8px 0 0 0; font-size: 13px; color: #e0f2fe; }
    .content { padding: 28px 24px; }
    .greeting { font-size: 17px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
    .text { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 20px; }
    .box { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 22px; }
    .box-title { font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
    .box-item { font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
    .box-item strong { color: #f1f5f9; }
    .btn-wa { display: block; text-align: center; background: #10b981; color: #ffffff !important; text-decoration: none; padding: 14px 20px; border-radius: 12px; font-weight: 800; font-size: 14px; margin-top: 24px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }
    .footer { background: #0f172a; padding: 18px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🚀 Olá, %s!</h1>
      <p>Recebemos sua solicitação de contato no SGM.PRO</p>
    </div>
    <div class="content">
      <div class="greeting">Tudo certo com a sua mensagem!</div>
      <div class="text">
        Agradecemos pelo seu interesse na maior rede inteligente de medição técnica terceirizada para lojas de planejados e marcenarias.<br><br>
        Nossa equipe técnica e comercial já recebeu os seus dados (Protocolo <strong>#%d</strong>) e entrará em contato em breve para apresentar a melhor solução para sua operação.
      </div>
      <div class="box">
        <div class="box-title">Resumo das Informações Registradas:</div>
        <div class="box-item">• <strong>Nome:</strong> %s</div>
        <div class="box-item">• <strong>Empresa / Perfil:</strong> %s</div>
        <div class="box-item">• <strong>Telefone:</strong> %s</div>
        <div class="box-item">• <strong>Cidade / UF:</strong> %s</div>
      </div>
      <div class="text">
        Se preferir falar conosco agora mesmo, clique no botão abaixo para iniciar uma conversa no WhatsApp:
      </div>
      <a href="https://wa.me/5511972980409?text=Ol%C3%A1+Marcelo%2C+acabei+de+enviar+meu+contato+pelo+site+do+SGM.PRO+e+gostaria+de+atendimento." class="btn-wa">
        💬 Conversar pelo WhatsApp
      </a>
    </div>
    <div class="footer">
      SGM.PRO • Plataforma Oficial de Gestão e Medição Técnica Terceirizada<br>
      Este é um e-mail automático de confirmação de recebimento.
    </div>
  </div>
</body>
</html>`, p.Nome, leadID, p.Nome, p.Empresa, p.Telefone, p.Cidade)

	// 1. Tenta envio pelo Resend
	rawResendKey := os.Getenv("RESEND_API_KEY")
	resendKey := strings.Trim(strings.TrimSpace(rawResendKey), "\"'")
	enviado := false

	if resendKey != "" {
		resendFrom := strings.Trim(strings.TrimSpace(os.Getenv("RESEND_FROM_EMAIL")), "\"'")
		if resendFrom == "" {
			resendFrom = "SGM.PRO <onboarding@resend.dev>"
		}

		payloadResend := map[string]interface{}{
			"from":    resendFrom,
			"to":      []string{p.Email},
			"subject": assunto,
			"html":    corpoHTML,
			"text":    corpoTxt,
		}

		bodyBytes, _ := json.Marshal(payloadResend)
		reqHttp, errReq := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(bodyBytes))
		if errReq == nil {
			reqHttp.Header.Set("Authorization", "Bearer "+resendKey)
			reqHttp.Header.Set("Content-Type", "application/json")
			client := &http.Client{Timeout: 10 * time.Second}
			respHttp, errResp := client.Do(reqHttp)
			if errResp == nil {
				respBytes, _ := io.ReadAll(respHttp.Body)
				respHttp.Body.Close()

				if respHttp.StatusCode == 200 || respHttp.StatusCode == 201 {
					logMsg("✅ [AUTO-RESPOSTA] E-mail entregue com sucesso para o cliente %s via Resend! (ID: %s)", p.Email, string(respBytes))
					enviado = true
				} else if respHttp.StatusCode == 403 {
					logMsg("⚠️ [AUTO-RESPOSTA RESEND 403] O Resend Sandbox não permite enviar para destinatários externos (%s) sem domínio verificado. Resposta: %s", p.Email, string(respBytes))
				} else {
					logMsg("❌ [AUTO-RESPOSTA RESEND] HTTP %d: %s", respHttp.StatusCode, string(respBytes))
				}
			}
		}
	}

	// 2. Tenta Fallback pelo SMTP Gmail (que permite enviar para qualquer e-mail quando autenticado)
	if !enviado {
		smtpHost := strings.Trim(strings.TrimSpace(os.Getenv("EMAIL_HOST")), "\"'")
		smtpPort := strings.Trim(strings.TrimSpace(os.Getenv("EMAIL_PORT")), "\"'")
		smtpUser := strings.Trim(strings.TrimSpace(os.Getenv("EMAIL_HOST_USER")), "\"'")
		smtpPass := strings.Trim(strings.TrimSpace(os.Getenv("EMAIL_HOST_PASSWORD")), "\"'")
		smtpPass = strings.ReplaceAll(smtpPass, " ", "")

		if smtpHost != "" && smtpPort != "" && smtpUser != "" && smtpPass != "" {
			fromEmail := strings.Trim(strings.TrimSpace(os.Getenv("DEFAULT_FROM_EMAIL")), "\"'")
			if fromEmail == "" {
				fromEmail = smtpUser
			}
			msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
				fromEmail, p.Email, assunto, corpoHTML))

			auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
			addr := fmt.Sprintf("%s:%s", smtpHost, smtpPort)
			if errSmtp := smtp.SendMail(addr, auth, fromEmail, []string{p.Email}, msg); errSmtp == nil {
				logMsg("✅ [AUTO-RESPOSTA] E-mail de confirmação enviado para o cliente %s via SMTP Gmail!", p.Email)
				enviado = true
			} else {
				logMsg("⚠️ [AUTO-RESPOSTA SMTP] Falha no envio via SMTP Gmail para %s: %v", p.Email, errSmtp)
			}
		}
	}

	if !enviado {
		logMsg("ℹ️ [AUTO-RESPOSTA PENDENTE] Para enviar confirmação direta aos clientes em qualquer domínio, é necessário verificar um domínio próprio no Resend ou ativar a Senha de App no Gmail.")
	}
}

