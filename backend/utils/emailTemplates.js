// backend/utils/emailTemplates.js
// -------------------------------------------------------------
//  1.  alarmEmail({ uid, alarms })
//  2.  testEmail()               ── plain function used for
//                                 /api/test-email
// -------------------------------------------------------------

const brand = {
  name : 'GSN IoT',
  url  : 'https://gsn-iot.com',          // <- change if you have a real site
  logo : 'https://i.imgur.com/5aNw4tb.png'  // 200×60 transparent PNG works best
};

const baseStyles = `
  /* prettier-ignore */
  @media (prefers-color-scheme:dark){
    body,table{background:#0f172a!important;color:#cbd5e1!important}
    .card{background:#1e293b!important}
    .btn  {background:#3b82f6!important;color:#fff!important}
  }
  a      {color:#3b82f6;text-decoration:none}
  .btn   {display:inline-block;padding:10px 18px;border-radius:6px;
          background:#3b82f6;color:#fff;font-weight:600;font-size:14px}
  .card  {border-radius:8px;border:1px solid #e2e8f0;padding:20px}
  .small {font-size:13px;color:#64748b}
  td,th  {padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:14px}
`;

function alarmRows(alarms){
  return alarms.map(a=>`
    <tr>
      <td>${a.sensorId}</td>
      <td>${a.value.toFixed(1)} °C</td>
      <td>${a.level}</td>
    </tr>`).join('');
}

function alarmEmail({ uid, alarms }){
  const subject = `🚨  Alarm on device ${uid}`;
  const html = /*html*/`
  <!doctype html><html>
  <head><meta charset=utf-8>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>${baseStyles}</style></head>
  <body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center" style="padding:25px">
        <table class="card" role="presentation" width="540" cellspacing="0" cellpadding="0">
          <tr><td align="center" style="padding-bottom:18px">
              <img src="${brand.logo}" alt="${brand.name}" height="48" />
          </td></tr>
          
          <tr><td>
            <h2 style="margin:0 0 12px 0;color:#ef4444">Alarm triggered on ${uid}</h2>
            <p style="margin:0 0 18px 0">
              One or more sensors have crossed the configured thresholds.
            </p>

            <table width="100%" cellspacing="0" cellpadding="0">
              <thead>
                <tr><th>Sensor</th><th>Value</th><th>Status</th></tr>
              </thead>
              <tbody>${alarmRows(alarms)}</tbody>
            </table>

            <p style="margin:22px 0 0 0">
              <a class="btn" href="${brand.url}/dashboard/device/${uid}">
                View live dashboard
              </a>
            </p>

            <p class="small" style="margin:28px 0 0 0">
              This mail was generated automatically by ${brand.name}.<br/>
              You’re receiving it because you belong to the same company as the device.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;
  return { subject, html };
}

function testEmail(){
  return {
    subject : 'SMTP test – it works! 🎉',
    html    : '<p>If you can read this, your e-mail configuration is good.</p>'
  };
}

module.exports = { alarmEmail, testEmail };
