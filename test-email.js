const nodemailer = require('nodemailer');
require('dotenv').config();

// Email configuration
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'mail.inoxworktables.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'inquiry@inoxworktables.com',
    pass: process.env.SMTP_PASS || 'xjQuzQ%4!,{%SY;D',
  },
  // Additional options for cPanel/shared hosting
  tls: {
    rejectUnauthorized: false // Accept self-signed certificates
  }
});

async function testEmailConnection() {
  console.log('🔄 Testing email connection...');
  console.log(`Host: ${process.env.SMTP_HOST || 'mail.inoxworktables.com'}`);
  console.log(`Port: ${process.env.SMTP_PORT || '587'}`);
  console.log(`User: ${process.env.SMTP_USER || 'inquiry@inoxworktables.com'}`);
  console.log('---');

  try {
    // Test connection
    await transporter.verify();
    console.log('✅ Email server connection verified successfully');
    return true;
  } catch (error) {
    console.error('❌ Email server connection failed:', error.message);
    return false;
  }
}

async function sendTestEmail() {
  console.log('📧 Sending test email...');
  
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'inquiry@inoxworktables.com',
      to: 'office-international@ampm.si', // Test email to company
      subject: '🧪 Test Email from INOX Configurator',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🧪 Email Test Successful!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">INOX Table Configurator Email System</p>
          </div>
          
          <div style="padding: 30px; background: #f8fafc;">
            <div style="background: white; padding: 20px; border-radius: 12px;">
              <h2 style="color: #1e40af; margin-top: 0;">Email Configuration Test</h2>
              <p>This is a test email to verify that your INOX table configurator email system is working correctly.</p>
              
              <h3 style="color: #1e40af;">Configuration Details:</h3>
              <ul style="background: #f1f5f9; padding: 15px; border-radius: 8px;">
                <li><strong>SMTP Host:</strong> ${process.env.SMTP_HOST || 'mail.inoxworktables.com'}</li>
                <li><strong>Port:</strong> ${process.env.SMTP_PORT || '587'}</li>
                <li><strong>From:</strong> ${process.env.EMAIL_FROM || process.env.SMTP_USER || 'inquiry@inoxworktables.com'}</li>
                <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
              </ul>
              
              <p style="color: #059669; font-weight: bold;">✅ Email system is working correctly!</p>
            </div>
          </div>
          
          <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-weight: bold;">AM & PM GLOBAL INTERNATIONAL d.o.o.</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">Email System Test</p>
          </div>
        </div>
      `,
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
    throw error;
  }
}

async function runTest() {
  console.log('🚀 Starting Email System Test');
  console.log('================================');
  
  try {
    // Test 1: Connection
    const connectionOk = await testEmailConnection();
    if (!connectionOk) {
      console.log('❌ Connection test failed. Stopping here.');
      return;
    }
    
    console.log('');
    
    // Test 2: Send email
    await sendTestEmail();
    
    console.log('');
    console.log('🎉 All tests passed! Email system is ready.');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Run the test
runTest();
