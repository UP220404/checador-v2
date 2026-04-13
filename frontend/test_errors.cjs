const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  try {
    await page.goto('http://localhost:5173/empleado/portal', { waitUntil: 'networkidle0' });
    
    // Check if the global error overlay is visible
    const errorText = await page.evaluate(() => {
      const el = document.getElementById('global-error');
      return (el && el.style.display !== 'none') ? el.innerText : null;
    });
    
    if (errorText) {
      console.log('GLOBAL ERROR OVERLAY TEXT:', errorText);
    } else {
      console.log('No global error overlay detected.');
    }
    
    const bodyHtml = await page.evaluate(() => document.body.innerHTML);
    console.log('BODY HTML:', bodyHtml.substring(0, 500));
  } catch (error) {
    console.log('Error navigating:', error.message);
  } finally {
    await browser.close();
  }
})();
