const url1 = "https://www.gov.il/he/departments/news/cyber_directorate/RSS";
const url2 = "https://rsshub.app/telegram/channel/CyberSecurityIL";

async function testFetch(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
        // 'Accept-Encoding': 'gzip, deflate, br', // omitting to let undici handle it
        'Referer': 'https://www.google.com/',
      }
    });
    console.log(url, res.status);
    if (res.ok) {
       const text = await res.text();
       console.log("Length:", text.length, "Start:", text.substring(0, 50));
    }
  } catch (e) {
    console.error("Error for", url, e.message);
  }
}
testFetch(url1).then(() => testFetch(url2));
