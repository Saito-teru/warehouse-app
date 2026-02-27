require('dotenv').config();
const db = require('../db');
const QRCode = require('qrcode');

(async () => {
  const { rows } = await db.query('SELECT id FROM equipment WHERE qr_png_base64 IS NULL');
  console.log('対象件数:', rows.length);

  for (const eq of rows) {
    const url = await QRCode.toDataURL(String(eq.id), { width: 200, margin: 2 });
    const base64 = url.replace(/^data:image\/png;base64,/, '');
    await db.query('UPDATE equipment SET qr_png_base64 = $1 WHERE id = $2', [base64, eq.id]);
    console.log('QR生成済み: ID', eq.id);
  }

  console.log('完了');
  process.exit();
})().catch(e => {
  console.error(e);
  process.exit(1);
});