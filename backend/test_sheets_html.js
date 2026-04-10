const SPREADSHEET_ID = '1tGgyRdl76vTFtaBVGqmYXyYb14bh8iy3EwhUruVyHdg';
const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/htmlview`;

fetch(url)
  .then(res => res.text())
  .then(text => {
    // google sheets HTML view embeds the list of sheets in a JS variable
    const match = text.match(/sheetNames:\[([^\]]+)\]/);
    if(match) {
        console.log("Found sheets:", match[1]);
    } else {
        // try another regex for newer google sheets format
        const match2 = text.match(/"name":"([^"]+)"/g);
        if(match2) {
            console.log("Found sheets via name property:", match2.slice(0, 15).join(', '));
        } else {
            console.log("No sheets found in HTML. Check manually.");
            // save to file to inspect
            require('fs').writeFileSync('sheets.html', text);
        }
    }
  })
  .catch(err => console.error(err));
