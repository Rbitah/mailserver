# Haraka Mail Server for tiyenitickets.site

## Features
- Accepts mail for `tiyenitickets.site`
- Listens on port `2525` for compatibility with Render
- Simple plugin setup
- Send/receive emails with Gmail and other providers

## Deploy to Render

1. Push this repo to GitHub
2. Create a **Web Service** on [Render.com](https://render.com/)
3. Use the following settings:
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Port: `2525`

## DNS Setup for tiyenitickets.site

Add these DNS records to ensure proper email delivery to Gmail and other providers:

- **MX Record**:  
  - Type: `MX`  
  - Name: `@`  
  - Value: `mail.tiyenitickets.site`  
  - Priority: `10`

- **A Record**:  
  - Type: `A`  
  - Name: `mail`  
  - Value: `<Render public IP or CNAME>`

- **SPF Record**:  
  - Type: `TXT`  
  - Name: `@`  
  - Value: `v=spf1 ip4:<Render public IP> -all`

- **DMARC Record**:
  - Type: `TXT`
  - Name: `_dmarc`
  - Value: `v=DMARC1; p=none; rua=mailto:postmaster@tiyenitickets.site`

- **PTR Record** (Reverse DNS):
  - Contact your hosting provider to set up reverse DNS for your server's IP to point to mail.tiyenitickets.site

> Important: After adding these records, wait for DNS propagation (24-48 hours) before testing with Gmail.

## Testing Email Delivery

1. Test SMTP connection:
```bash
telnet mail.tiyenitickets.site 2525
```

2. Send a test email through the web interface at:
```
http://mail.tiyenitickets.site:3000
```

## Troubleshooting Gmail Delivery

If emails are not reaching Gmail:

1. Check Gmail spam folder
2. Verify all DNS records are properly propagated using:
   ```bash
   dig TXT tiyenitickets.site
   dig MX tiyenitickets.site
   dig TXT _dmarc.tiyenitickets.site
   ```
3. Make sure your server's IP is not blacklisted