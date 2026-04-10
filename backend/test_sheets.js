const SPREADSHEET_ID = '1tGgyRdl76vTFtaBVGqmYXyYb14bh8iy3EwhUruVyHdg';

const options = [
  'Miércoles 25 Mar',
  'Miercoles 25 Mar',
  'Miércoles 25 Marzo',
  'Miercoles 25 Marzo',
  'Miércoles 25 de Mar',
  '25 Mar',
  '25 de Marzo',
  'Miercoles 25',
  'Miércoles 25',
  '25 Marzo',
  '25-Mar'
];

async function check() {
  for (const name of options) {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
    try {
      const res = await fetch(url);
      const text = await res.text();
      // If the sheet doesn't exist, it usually falls back to the very first sheet.
      // So let's check the very first line of the CSV response.
      const firstLine = text.split('\n')[0].replace(/"/g, '').trim();
      
      console.log(`[${name}] -> ${firstLine.substring(0, 50)}...`);
    } catch(e) {
      console.log(`[${name}] err: ${e.message}`);
    }
  }
}

check();
