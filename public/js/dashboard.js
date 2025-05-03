class EmailDashboard {
    constructor() {
        this.currentFolder = 'inbox';
        this.token = window.authToken;
        
        if (!this.token) {
            window.location.href = '/';
            return;
        }
        
        this.loadUserData().then(() => {
            this.setupEventListeners();
            this.loadEmails();
            document.querySelector('.mail-container').style.display = 'flex';
            document.querySelector('.loading-screen').style.display = 'none';
        }).catch(error => {
            console.error('Failed to load user data:', error);
            window.location.href = '/';
        });
    }

    async loadUserData() {
        const response = await this.makeAuthenticatedRequest('/api/user');
        if (!response || !response.ok) {
            throw new Error('Failed to load user data');
        }
        
        const { user, emails } = await response.json();
        this.user = user;
        
        // Update UI with user info
        const userInfo = document.querySelector('.user-info');
        userInfo.innerHTML = `
            <h3>${user.name}</h3>
            <p>${user.email}</p>
        `;
        
        return { user, emails };
    }

    setupEventListeners() {
        // Folder navigation
        document.querySelectorAll('.folders li').forEach(folder => {
            folder.addEventListener('click', () => this.changeFolder(folder.dataset.folder));
        });

        // Compose button
        document.querySelector('.compose-btn').addEventListener('click', () => {
            document.querySelector('.compose-modal').style.display = 'flex';
        });

        // Close compose modal
        document.querySelector('.cancel-btn').addEventListener('click', () => {
            document.querySelector('.compose-modal').style.display = 'none';
        });

        // Send email
        document.getElementById('composeForm').addEventListener('submit', (e) => this.sendEmail(e));

        // Email item click
        document.querySelector('.email-list').addEventListener('click', (e) => {
            const emailItem = e.target.closest('.email-item');
            if (emailItem) this.viewEmail(emailItem.dataset.id);
        });

        // Reply button
        document.querySelector('.reply-btn').addEventListener('click', () => this.replyToEmail());

        // Delete button
        document.querySelector('.delete-btn').addEventListener('click', () => this.deleteEmail());
    }

    async makeAuthenticatedRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        };
        
        const response = await fetch(url, { ...defaultOptions, ...options });
        if (response.status === 401 || response.status === 403) {
            window.location.href = '/';
            return null;
        }
        return response;
    }

    async loadEmails() {
        try {
            const response = await this.makeAuthenticatedRequest(`/api/emails?folder=${this.currentFolder}`);
            if (!response) return;
            
            const emails = await response.json();
            this.renderEmails(emails);
        } catch (error) {
            console.error('Error loading emails:', error);
        }
    }

    renderEmails(emails) {
        const emailList = document.querySelector('.email-list');
        emailList.innerHTML = emails.map(email => `
            <div class="email-item ${email.read ? 'read' : 'unread'}" data-id="${email.id}">
                <div class="email-sender">${email.from_email}</div>
                <div class="email-subject">${email.subject}</div>
                <div class="email-date">${new Date(email.received_date).toLocaleString()}</div>
            </div>
        `).join('');
    }

    async viewEmail(emailId) {
        try {
            const response = await this.makeAuthenticatedRequest(`/api/emails/${emailId}`);
            if (!response) return;
            
            const email = await response.json();
            document.querySelector('.email-view').style.display = 'block';
            document.querySelector('.email-content').innerHTML = `
                <h3>${email.subject}</h3>
                <p><strong>From:</strong> ${email.from_email}</p>
                <p><strong>Date:</strong> ${new Date(email.received_date).toLocaleString()}</p>
                <div class="email-body">${email.html || email.body}</div>
            `;
        } catch (error) {
            console.error('Error viewing email:', error);
        }
    }

    async sendEmail(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            const response = await this.makeAuthenticatedRequest('/api/send-email', {
                method: 'POST',
                body: JSON.stringify({
                    to: formData.get('to'),
                    subject: formData.get('subject'),
                    text: formData.get('body')
                })
            });

            if (response && response.ok) {
                document.querySelector('.compose-modal').style.display = 'none';
                e.target.reset();
                this.loadEmails();
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to send email');
            }
        } catch (error) {
            alert('An error occurred while sending the email');
        }
    }

    changeFolder(folder) {
        this.currentFolder = folder;
        document.querySelectorAll('.folders li').forEach(f => {
            f.classList.toggle('active', f.dataset.folder === folder);
        });
        this.loadEmails();
    }

    async deleteEmail() {
        const emailId = document.querySelector('.email-view').dataset.emailId;
        if (!emailId) return;

        try {
            const response = await this.makeAuthenticatedRequest(`/api/emails/${emailId}`, {
                method: 'DELETE'
            });
            
            if (response && response.ok) {
                document.querySelector('.email-view').style.display = 'none';
                this.loadEmails();
            }
        } catch (error) {
            console.error('Error deleting email:', error);
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new EmailDashboard();
});