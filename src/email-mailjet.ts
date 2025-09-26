// Mailjet Email Service for INOX Table Configurator
// This replaces the old Nodemailer implementation with Mailjet API

// Mailjet API configuration
const MAILJET_API_URL = 'https://api.mailjet.com/v3.1/send';

// Create Mailjet API client
async function sendMailjetEmail(emailData: {
  to: Array<{ Email: string; Name?: string }>;
  from: { Email: string; Name: string };
  subject: string;
  html: string;
  attachments?: Array<{
    ContentType: string;
    Filename: string;
    Base64Content: string;
  }>;
}) {
  const PUBLIC_KEY = process.env.MJ_APIKEY_PUBLIC;
  const PRIVATE_KEY = process.env.MJ_APIKEY_PRIVATE;

  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    throw new Error('Mailjet API keys not configured: MJ_APIKEY_PUBLIC and MJ_APIKEY_PRIVATE are required');
  }

  console.log('Testing Mailjet with keys:', PUBLIC_KEY.substring(0, 8) + '...', PRIVATE_KEY.substring(0, 8) + '...');
  
  const response = await fetch(MAILJET_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`${PUBLIC_KEY}:${PRIVATE_KEY}`).toString('base64'),
    },
    body: JSON.stringify({
      Messages: [{
        From: emailData.from,
        To: emailData.to,
        Subject: emailData.subject,
        HTMLPart: emailData.html,
        ...(emailData.attachments && { Attachments: emailData.attachments })
      }]
    })
  });

  const result = await response.json();
  
  if (!response.ok) {
    console.error('Mailjet API error:', {
      status: response.status,
      statusText: response.statusText,
      result: result
    });
    throw new Error(`Mailjet API error: ${response.status} ${response.statusText} - ${JSON.stringify(result)}`);
  }

  return result;
}

export interface InquiryData {
  product_type: string;
  dimension: string;
  delivery_days: number;
  advance_payment: string;
  quantity: number;
  name: string;
  email: string;
  note: string;
  price?: number;
  timestamp: string;
  inquiryId: string;
}

export interface PriceBreakdown {
  base_price: number;
  total_price: number;
  delivery_fee?: number;
  discounts_applied?: number;
  price_per_unit?: number;
  quantity?: number;
}

// Test Mailjet connection
export async function testEmailConnection() {
  try {
    const PUBLIC_KEY = process.env.MJ_APIKEY_PUBLIC;
    const PRIVATE_KEY = process.env.MJ_APIKEY_PRIVATE;
    
    console.log('Testing with keys:', PUBLIC_KEY?.substring(0, 8) + '...', PRIVATE_KEY?.substring(0, 8) + '...');
    
    if (!PUBLIC_KEY || !PRIVATE_KEY) {
      throw new Error('Mailjet API keys not configured');
    }

    // Test with a simple API call to verify credentials
    const response = await fetch('https://api.mailjet.com/v3/REST/contact', {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${PUBLIC_KEY}:${PRIVATE_KEY}`).toString('base64'),
      },
    });

    const result = await response.text();
    console.log('Mailjet API response:', response.status, response.statusText, result);

    if (response.ok) {
      console.log('✅ Mailjet API connection verified successfully');
      return { success: true, message: 'Mailjet connection verified' };
    } else {
      console.error('❌ Mailjet API failed:', response.status, response.statusText, result);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${result}`);
    }
  } catch (error: any) {
    console.error('❌ Mailjet API connection failed:', error);
    return { success: false, message: `Mailjet connection failed: ${error.message}` };
  }
}

export async function sendInquiryEmail(inquiry: InquiryData, priceBreakdown?: PriceBreakdown) {
  // Validate Mailjet configuration
  if (!process.env.MJ_APIKEY_PUBLIC || !process.env.MJ_APIKEY_PRIVATE) {
    throw new Error('Mailjet configuration missing: MJ_APIKEY_PUBLIC and MJ_APIKEY_PRIVATE are required');
  }

  // Validate inquiry data
  if (!inquiry.name || !inquiry.email || !inquiry.inquiryId) {
    throw new Error('Invalid inquiry data: name, email, and inquiryId are required');
  }

  const productType = inquiry.product_type === "dimensioned" 
    ? "Custom Dimensioned Table" 
    : inquiry.product_type.replace("_", " ").toUpperCase();
  
  const dimensions = inquiry.product_type === "dimensioned" 
    ? inquiry.dimension + " cm" 
    : "Standard size";

  const advancePayment = inquiry.advance_payment === "none" 
    ? "No advance payment" 
    : inquiry.advance_payment + "% advance";

  // Email to company
  const companyEmailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🔔 New INOX Table Inquiry</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">ID: ${inquiry.inquiryId}</p>
      </div>
      
      <div style="padding: 30px; background: #f8fafc;">
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin-top: 0;">Product Configuration</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Product Type:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${productType}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Dimensions:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${dimensions}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Quantity:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${inquiry.quantity}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Delivery Time:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${inquiry.delivery_days} days</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Advance Payment:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${advancePayment}</td></tr>
            ${inquiry.price ? `<tr><td style="padding: 8px 0; color: #059669;"><strong>Estimated Total:</strong></td><td style="padding: 8px 0; color: #059669; font-size: 18px; font-weight: bold;">€${inquiry.price}</td></tr>` : ''}
          </table>
        </div>

        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin-top: 0;">Customer Information</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${inquiry.name}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Email:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${inquiry.email}">${inquiry.email}</a></td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Submitted:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${inquiry.timestamp}</td></tr>
          </table>
          ${inquiry.note ? `<div style="margin-top: 15px;"><strong>Additional Notes:</strong><div style="background: #f1f5f9; padding: 10px; border-radius: 6px; margin-top: 5px;">${inquiry.note}</div></div>` : ''}
        </div>

        ${priceBreakdown ? `
        <div style="background: white; padding: 20px; border-radius: 12px;">
          <h2 style="color: #1e40af; margin-top: 0;">Price Breakdown</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 4px 0;">Base Price:</td><td style="text-align: right;">€${priceBreakdown.base_price}</td></tr>
            ${priceBreakdown.discounts_applied ? `<tr><td style="padding: 4px 0;">Discounts Applied:</td><td style="text-align: right; color: #dc2626;">-€${priceBreakdown.discounts_applied}</td></tr>` : ''}
            ${priceBreakdown.delivery_fee ? `<tr><td style="padding: 4px 0;">Delivery Fee:</td><td style="text-align: right;">+€${priceBreakdown.delivery_fee}</td></tr>` : ''}
            ${priceBreakdown.quantity && priceBreakdown.quantity > 1 ? `<tr><td style="padding: 4px 0;">Quantity:</td><td style="text-align: right;">${priceBreakdown.quantity} pieces</td></tr>` : ''}
            ${priceBreakdown.price_per_unit ? `<tr><td style="padding: 4px 0;">Price per Unit:</td><td style="text-align: right;">€${priceBreakdown.price_per_unit}</td></tr>` : ''}
            <tr style="border-top: 2px solid #1e40af; font-weight: bold; font-size: 16px;"><td style="padding: 8px 0;">TOTAL:</td><td style="text-align: right; color: #059669;">€${priceBreakdown.total_price}</td></tr>
          </table>
        </div>
        ` : ''}
      </div>
      
      <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
        <p style="margin: 0; font-size: 14px;">AM & PM GLOBAL INTERNATIONAL d.o.o.</p>
        <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">Gradnikove Brigade 19, SI-5000 Nova Gorica</p>
      </div>
    </div>
  `;

  // Email to customer
  const customerEmailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">✅ Thank You for Your Inquiry!</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Reference ID: ${inquiry.inquiryId}</p>
      </div>
      
      <div style="padding: 30px; background: #f8fafc;">
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin-top: 0;">Hello ${inquiry.name}!</h2>
          <p>Thank you for your interest in our INOX tables. We have received your inquiry and our sales team will prepare a detailed quote for you.</p>
          
          <h3 style="color: #1e40af;">Your Configuration Summary:</h3>
          <ul style="background: #f1f5f9; padding: 15px; border-radius: 8px; list-style: none; margin: 0;">
            <li style="padding: 5px 0;">📋 <strong>Product:</strong> ${productType}</li>
            <li style="padding: 5px 0;">📏 <strong>Dimensions:</strong> ${dimensions}</li>
            <li style="padding: 5px 0;">🔢 <strong>Quantity:</strong> ${inquiry.quantity}</li>
            <li style="padding: 5px 0;">🚚 <strong>Delivery:</strong> ${inquiry.delivery_days} days</li>
            <li style="padding: 5px 0;">💳 <strong>Payment:</strong> ${advancePayment}</li>
            ${inquiry.price ? `<li style="padding: 5px 0; color: #059669; font-weight: bold;">💰 <strong>Estimated Total:</strong> €${inquiry.price}</li>` : ''}
          </ul>
        </div>

        <div style="background: #dbeafe; padding: 20px; border-radius: 12px; border-left: 4px solid #1e40af;">
          <h3 style="color: #1e40af; margin-top: 0;">What happens next?</h3>
          <ol style="margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 10px;">Our sales team will review your requirements and prepare a detailed quote</li>
            <li style="margin-bottom: 10px;">You will receive a comprehensive proposal via email within 24 hours</li>
            <li style="margin-bottom: 10px;">We will contact you to discuss any questions and finalize your order</li>
          </ol>
        </div>
      </div>
      
      <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
        <p style="margin: 0; font-weight: bold;">AM & PM GLOBAL INTERNATIONAL d.o.o.</p>
        <p style="margin: 5px 0;">📧 office-international@ampm.si | 📞 +386 41 643 189</p>
        <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">Gradnikove Brigade 19, SI-5000 Nova Gorica, Slovenia</p>
      </div>
    </div>
  `;

  try {
    // Send email to company using Mailjet
    await sendMailjetEmail({
      from: {
        Email: process.env.EMAIL_FROM || 'noreply@ampm.si',
        Name: 'INOX Table Configurator'
      },
      to: [{
        Email: process.env.EMAIL_TO || 'office-international@ampm.si',
        Name: 'AM & PM Sales Team'
      }],
      subject: `🔔 New INOX Table Inquiry - ${inquiry.inquiryId} - ${productType}`,
      html: companyEmailHtml
    });

    // Send confirmation email to customer using Mailjet
    // COMMENTED OUT: Only send to sales team, not to customer
    // await sendMailjetEmail({
    //   from: {
    //     Email: process.env.EMAIL_FROM || 'noreply@ampm.si',
    //     Name: 'AM & PM Global International'
    //   },
    //   to: [{
    //     Email: inquiry.email,
    //     Name: inquiry.name
    //   }],
    //   subject: `✅ Your INOX Table Inquiry Confirmation - ${inquiry.inquiryId}`,
    //   html: customerEmailHtml
    // });

    console.log(`✅ Inquiry emails sent successfully via Mailjet for ${inquiry.inquiryId}`);
  } catch (error: any) {
    console.error(`❌ Failed to send inquiry emails via Mailjet for ${inquiry.inquiryId}:`, error);
    throw new Error(`Mailjet email sending failed: ${error.message}`);
  }
}

// Optional: Function to send emails with PDF attachments (for future use)
export async function sendEmailWithPDF(
  to: string,
  toName: string,
  subject: string,
  htmlContent: string,
  pdfBase64: string,
  pdfFilename: string = 'quote.pdf'
) {
  await sendMailjetEmail({
    from: {
      Email: process.env.EMAIL_FROM || 'noreply@ampm.si',
      Name: 'AM & PM Global International'
    },
    to: [{
      Email: to,
      Name: toName
    }],
    subject,
    html: htmlContent,
    attachments: [{
      ContentType: 'application/pdf',
      Filename: pdfFilename,
      Base64Content: pdfBase64
    }]
  });
}
