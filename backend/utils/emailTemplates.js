function alarmEmail({ uid, alarms, when = new Date() }) {
  const items = alarms
    .map(a => `<li><strong>${a.sensorId}</strong> – ${a.value.toFixed(1)} °C – ${a.level}</li>`)
    .join("");

  return {
    subject: `🚨 Alarm on device ${uid}`,
    html: `
      <h2 style="margin:0">Alarm from ${uid}</h2>
      <p>${when.toLocaleString()}</p>
      <ul style="padding-left:18px;margin:12px 0">${items}</ul>
      <p style="font-size:13px;color:#606060">
        You’ll receive just one e-mail per alarm episode.  
        A new e-mail is sent only after readings return to normal
        and cross the threshold again.</p>`
  };
}

module.exports = { alarmEmail };
