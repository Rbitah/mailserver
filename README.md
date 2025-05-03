# Haraka Mail Server for tiyenitickets.site

## Features
- Web interface for email management
- SMTP server for sending/receiving emails
- User authentication and email folders
- Database storage for emails and users

## Port Configuration
- Web Interface: Runs on port 10000 (or PORT environment variable on Render)
- SMTP Server: Fixed on port 2525 (standard SMTP submission port)

## Deploy to Render

1. Push this repo to GitHub
2. Create a **Web Service** on [Render.com](https://render.com/)
3. Use the following settings:
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables:
     - `PORT`: Will be set automatically by Render
     - `JWT_SECRET`: Set your own secure secret
   - Open Ports: Both 2525 and web port will be available

## DNS Setup for tiyenitickets.site

Add these DNS records to ensure proper email delivery:

- **MX Record**:  
  - Type: `MX`  
  - Name: `@`  
  - Value: `mail.tiyenitickets.site`  
  - Priority: `10`

- **A Record**:  
  - Type: `A`  
  - Name: `mail`  
  - Value: `<Render public IP>`

- **SPF Record**:  
  - Type: `TXT`  
  - Name: `@`  
  - Value: `v=spf1 ip4:<Render public IP> -all`

- **DMARC Record**:
  - Type: `TXT`
  - Name: `_dmarc`
  - Value: `v=DMARC1; p=none; rua=mailto:postmaster@tiyenitickets.site`

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Access:
   - Web Interface: http://localhost:10000
   - SMTP: localhost:2525

## Testing Email Delivery

1. Test SMTP connection:
```bash
telnet localhost 2525
```

2. Send a test email through the web interface:
```
http://localhost:10000
```

## Troubleshooting

1. Port conflicts:
   - Web port (10000) can be changed via PORT environment variable
   - SMTP port (2525) is fixed for consistent email routing

2. Email Delivery:
   - Check spam folders
   - Verify DNS records
   - Ensure Render ports are properly exposed