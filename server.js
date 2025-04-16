//process.env.PUPPETEER_CACHE_DIR = '/tmp/puppeteer';
const puppeteer = require('puppeteer');
const path = require('path');
const axios = require('axios');
const puppeteerExtra = require('puppeteer-extra');
const puppeteerExtraPluginStealth = require('puppeteer-extra-plugin-stealth');
const express = require('express');
const app = express();
const cors = require('cors');
const functions = require('firebase-functions'); // Use CommonJS for Firebase Functions
const chromium = require('chrome-aws-lambda'); // Install this: npm install chrome-aws-lambda
const cheerio = require('cheerio');
const fs = require("fs");
const sharp = require('sharp');
const admin = require("firebase-admin");
const nodemailer = require('nodemailer');
require("dotenv").config();

admin.initializeApp();
/*app.use(cors({
  origin: [
    'http://localhost:5001', // local testing html page
    'https://shange-fagan.github.io', // GitHub Pages
    'https://horizonflights.org', // Production domain
    'http://localhost:3000', // local testing html backend
    'https://b4a4-136-148-37-26.ngrok-free.app'
],
  methods: ['GET', 'POST']
}));*/
/*app.use(cors({
    origin: [
        'https://horizonflights.org/',
        'http://localhost:5001',
    ],
  methods: ['GET', 'POST'], // Specify allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
  credentials: true, // Enable cookies/credentials if required
}));*/
// ✅ Allow Specific Origins (Add your frontend URL here)
const allowedOrigins = [
    "https://horizonflights.org", // Production
    "http://localhost:3005",      // Local Testing
    "https://shange-fagan.github.io" // GitHub Pages
];

// ✅ Enable CORS with Custom Options
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, ngrok-skip-browser-warning"
      );
        res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
        return res.status(204).send();
    }
    next();
});

// ✅ Handle OPTIONS Requests (Preflight Requests)
app.options("*", (req, res) => {
    res.set({
        "Access-Control-Allow-Origin": req.headers.origin || "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
        "Access-Control-Allow-Credentials": "true"
    });
    return res.status(204).send(); // 204 No Content
});
app.get('/', (req, res) => res.send('Server is working!'));

// Start the server
// Add the stealth plugin to puppeteer-extra
puppeteerExtra.use(puppeteerExtraPluginStealth());

//const cors = require('cors')({ origin: true });
// Middleware
//app.use(cors());
//app.use(express.json());



// Serve static files from the public directory
//app.use(express.static(path.join(__dirname, 'public')));

// Handle the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Proper CORS setup
// Use CORS to allow requests from your frontend domain
// Allow CORS from your GitHub Pages domain
/*app.use(cors({
    origin: [
        'http://localhost:5001', // Allow requests from localhost
        'https://shange-fagan.github.io', // Frontend deployment domain
        'https://airbnbexplorer.com', // Your custom domain
        'https://api-omx7tvjdea-uc.a.run.app' // Your API domain
    ],
    methods: 'GET,POST',
    allowedHeaders: 'Content-Type,Authorization',
}));
app.options('*', cors()); // Enable preflight across all routes
*/
/*const corsConfig = cors({
  origin: [
    'http://localhost:5001', // Emulator
    'http://127.0.0.1:5001', // IP-based localhost
    'http://localhost:4000', // Emulator UI
    'https://shange-fagan.github.io', // GitHub Pages
    'https://airbnbexplorer.com', // Custom domain
    'https://api-omx7tvjdea-uc.a.run.app', // Cloud Run API
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
app.use(corsConfig);
app.options('*', (req, res) => {
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
  });
app.options('*', corsConfig);*/
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email provider
  auth: {
    user: 'horizonflights.co@gmail.com',
    pass: 'Jesusisgreat123' // not your main password if you're using Gmail!
  }
});
app.post('/send-welcome-email', async (req, res) => {
  const { email } = req.body;

  const mailOptions = {
    from: 'horizonflights.co@gmail.com',
    to: email,
    subject: 'Welcome to Horizon Flights ✈️',
    html: `<h2>Welcome aboard!</h2><p>Thanks for signing up. Exciting deals await 🌍</p>`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send('Welcome email sent!');
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).send('Error sending welcome email');
  }
});
// 📅 Weekly Campaign Email
app.post("/send-regular-email", async (req, res) => {
  const { email, subject, message } = req.body;

  const mailOptions = {
    from: 'horizonflights.co@gmail.com',
    to: email,
    subject: subject || "This Week's Deals!",
    text: message || "Here are the best flights and hotel offers this week.",
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Weekly email sent successfully" });
  } catch (error) {
    console.error("Failed to send regular email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});
function waitForTimeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
// Your 2Captcha API key
const API_KEY = "16c0c7f393fd4c7dba5da76441c5a008";
// Function to solve captchas
async function solveCaptcha(page) {
  const pixelmatch = (await import('pixelmatch')).default;
  const { PNG } = await import('pngjs');

  console.log("Detecting CAPTCHA...");

  // Wait for the CAPTCHA elements to appear
  await page.waitForSelector('img.sc-7csxyx-1.blhSFq', { timeout: 30000 });

  // Capture the reference image (left side)
  const referenceImage = await page.$('img.sc-7csxyx-1.blhSFq'); // Adjust selector for reference image
  if (!referenceImage) throw new Error("Reference image not found!");

  await referenceImage.screenshot({ path: 'reference.png' });
  console.log("Captured reference image.");

  // Capture the interactive image (right side)
  const interactiveImage = await page.$('img.sc-168ufhb-1.kaljUZ.key-frame-image'); // Adjust selector for interactive image
  if (!interactiveImage) throw new Error("Interactive image not found!");

  // Select the rotate buttons
  const rotateRightButton = await page.$('a.sc-7csxyx-2.sc-7csxyx-4.ioYDmH.g0Oozv.right-arrow'); // Adjusted selector
  if (!rotateRightButton) throw new Error("Rotate button not found!");

  // Rotate the interactive image and compare with the reference
  const maxRotations = 10; // Arbitrary number of maximum rotations to avoid infinite loops
  let solved = false;

  for (let i = 0; i < maxRotations; i++) {
      console.log(`Rotating interactive image: Attempt ${i + 1}`);

      // Capture the current state of the interactive image
      await interactiveImage.screenshot({ path: `interactive_${i}.png` });

      // Compare the interactive image with the reference image
      const img1 = PNG.sync.read(fs.readFileSync('reference.png'));
      const img2 = PNG.sync.read(fs.readFileSync(`interactive_${i}.png`));
      const { width, height } = img1;
      const diff = new PNG({ width, height });

      const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, {
          threshold: 0.1,
      });

      if (numDiffPixels === 0) {
          console.log("Images match! CAPTCHA solved.");
          solved = true;
          break;
      }

      // Rotate the image for the next comparison
      await rotateRightButton.click();
      await page.waitForTimeout(500); // Small delay between rotations
  }

  if (!solved) throw new Error("Failed to solve CAPTCHA within max rotations.");

  // Submit the CAPTCHA
  const submitButton = await page.$('button[aria-label="Submit"]'); // Adjust selector for Submit button
  if (submitButton) {
      await submitButton.click();
      console.log("CAPTCHA solved and submitted.");
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
  } else {
      throw new Error("Submit button not found.");
  }
}
  async function navigateToPageWithRetry(page, url, maxRetries = 3) {
    let attempt = 0;
  
    while (attempt < maxRetries) {
        try {
            console.log(`Attempt ${attempt + 1} to load the page.`);
            // Navigate to the URL with an extended timeout
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 60000 // Set timeout to 60 seconds
            });
            console.log("Page loaded successfully.");
            return; // Exit the function if successful
        } catch (error) {
            attempt++;
            console.warn(`Attempt ${attempt} failed: ${error.message}`);
            if (attempt >= maxRetries) {
                console.error("Failed to load the page after multiple attempts.");
                throw error; // Rethrow the error if max retries are exceeded
            }
            console.log("Retrying...");
        }
    }
  }

async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
        ]
  });
  return browser;
}
async function launchBrowser2() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--proxy-server=http://pr.oxylabs.io:7777',  // ✅ Apply proxy
    ],
    ignoreHTTPSErrors: true,
  });
  return browser;
}

// Helper function to map locations to Expedia format
const locationMapper = (location) => {
  const locationMap = {
      "algeria": "Algiers, Algeria (ALG-Houari Boumediene)",
  "angola": "Luanda, Angola (LAD-Quatro de Fevereiro)",
  "benin": "Cotonou, Benin (COO-Cadjehoun)",
  "botswana": "Gaborone, Botswana (GBE-Sir Seretse Khama)",
  "burkina faso": "Ouagadougou, Burkina Faso (OUA-Ouagadougou)",
  "burundi": "Bujumbura, Burundi (BJM-Bujumbura International)",
  "cameroon": "Douala, Cameroon (DLA-Douala International)",
  "cape verde": "Praia, Cape Verde (RAI-Praia International)",
  "central african republic": "Bangui, Central African Republic (BGF-M'Poko)",
  "chad": "N'Djamena, Chad (NDJ-N'Djamena International)",
  "comoros": "Moroni, Comoros (HAH-Prince Said Ibrahim)",
  "djibouti": "Djibouti, Djibouti (JIB-Djibouti-Ambouli)",
  "egypt": "Cairo, Egypt (CAI-Cairo International)",
  "eritrea": "Asmara, Eritrea (ASM-Asmara International)",
  "eswatini": "Mbabane, Eswatini (MTS-Matsapha International)",
  "ethiopia": "Addis Ababa, Ethiopia (ADD-Bole International)",
  "gabon": "Libreville, Gabon (LBV-Libreville International)",
  "gambia": "Banjul, Gambia (BJL-Banjul International)",
  "ghana": "Accra, Ghana (ACC-Kotoka International)",
  "guinea": "Conakry, Guinea (CKY-Conakry International)",
  "kenya": "Nairobi, Kenya (NBO-Jomo Kenyatta International)",
  "lesotho": "Maseru, Lesotho (MSU-Moshoeshoe I International)",
  "madagascar": "Antananarivo, Madagascar (TNR-Ivato International)",
  "morocco": "Casablanca, Morocco (CMN-Mohammed V International)",
  "nigeria": "Lagos, Nigeria (LOS-Murtala Muhammed International)",
  "south africa": "Johannesburg, South Africa (JNB-O.R. Tambo International)",
  "afghanistan": "Kabul, Afghanistan (KBL-Hamid Karzai International)",
  "armenia": "Yerevan, Armenia (EVN-Zvartnots International)",
  "azerbaijan": "Baku, Azerbaijan (GYD-Heydar Aliyev International)",
  "bahrain": "Manama, Bahrain (BAH-Bahrain International)",
  "bangladesh": "Dhaka, Bangladesh (DAC-Hazrat Shahjalal International)",
  "bhutan": "Paro, Bhutan (PBH-Paro International)",
  "brunei": "Bandar Seri Begawan, Brunei (BWN-Brunei International)",
  "cambodia": "Phnom Penh, Cambodia (PNH-Phnom Penh International)",
  "china": "Beijing, China (PEK-Beijing Capital International)",
  "cyprus": "Larnaca, Cyprus (LCA-Larnaca International)",
  "georgia": "Tbilisi, Georgia (TBS-Tbilisi International)",
  "india": "Delhi, India (DEL-Indira Gandhi International)",
  "indonesia": "Jakarta, Indonesia (CGK-Soekarno Hatta International)",
  "iran": "Tehran, Iran (IKA-Imam Khomeini International)",
  "iraq": "Baghdad, Iraq (BGW-Baghdad International)",
  "israel": "Tel Aviv, Israel (TLV-Ben Gurion International)",
  "japan": "Tokyo, Japan (NRT-Narita International)",
  "jordan": "Amman, Jordan (AMM-Queen Alia International)",
  "kazakhstan": "Almaty, Kazakhstan (ALA-Almaty International)",
  "kuwait": "Kuwait City, Kuwait (KWI-Kuwait International)",
  "kyrgyzstan": "Bishkek, Kyrgyzstan (FRU-Manas International)",
  "laos": "Vientiane, Laos (VTE-Wattay International)",
  "lebanon": "Beirut, Lebanon (BEY-Beirut-Rafic Hariri International)",
  "malaysia": "Kuala Lumpur, Malaysia (KUL-Kuala Lumpur International)",
  "maldives": "Male, Maldives (MLE-Velana International)",
  "mongolia": "Ulaanbaatar, Mongolia (ULN-Chinggis Khaan International)",
  "myanmar": "Yangon, Myanmar (RGN-Yangon International)",
  "nepal": "Kathmandu, Nepal (KTM-Tribhuvan International)",
  "oman": "Muscat, Oman (MCT-Muscat International)",
  "pakistan": "Karachi, Pakistan (KHI-Jinnah International)",
  "philippines": "Manila, Philippines (MNL-Ninoy Aquino International)",
  "qatar": "Doha, Qatar (DOH-Hamad International)",
  "saudi arabia": "Riyadh, Saudi Arabia (RUH-King Khalid International)",
  "singapore": "Singapore (SIN-Changi International)",
  "south korea": "Seoul, South Korea (ICN-Incheon International)",
  "sri lanka": "Colombo, Sri Lanka (CMB-Bandaranaike International)",
  "syria": "Damascus, Syria (DAM-Damascus International)",
  "taiwan": "Taipei, Taiwan (TPE-Taiwan Taoyuan International)",
  "thailand": "Bangkok, Thailand (BKK-Suvarnabhumi)",
  "turkey": "Istanbul, Turkey (IST-Istanbul Airport)",
  "uzbekistan": "Tashkent, Uzbekistan (TAS-Tashkent International)",
  "vietnam": "Hanoi, Vietnam (HAN-Noi Bai International)",
  "yemen": "Sana'a, Yemen (SAH-Sana'a International)",
  "argentina": "Buenos Aires, Argentina (EZE-Ministro Pistarini International)",
  "canada": "Toronto, Canada (YYZ-Pearson International)",
  "mexico": "Mexico City, Mexico (MEX-Benito Juarez International)",
  "united states": "New York, United States (JFK-John F. Kennedy International)",
  "brazil": "Rio de Janeiro, Brazil (GIG-Galeão International)",
  "chile": "Santiago, Chile (SCL-Arturo Merino Benitez)",
  "colombia": "Bogota, Colombia (BOG-El Dorado International)",
  "cuba": "Havana, Cuba (HAV-Jose Marti International)",
  "dominican republic": "Santo Domingo, Dominican Republic (SDQ-Las Americas International)",
  "peru": "Lima, Peru (LIM-Jorge Chavez International)",
  "venezuela": "Caracas, Venezuela (CCS-Simon Bolivar International)",
  "albania": "Tirana, Albania (TIA-Tirana International)",
  "austria": "Vienna, Austria (VIE-Vienna International)",
  "belgium": "Brussels, Belgium (BRU-Brussels Airport)",
  "bulgaria": "Sofia, Bulgaria (SOF-Sofia Airport)",
  "croatia": "Zagreb, Croatia (ZAG-Zagreb Airport)",
  "czech republic": "Prague, Czech Republic (PRG-Václav Havel Airport)",
  "denmark": "Copenhagen, Denmark (CPH-Kastrup Airport)",
  "estonia": "Tallinn, Estonia (TLL-Lennart Meri Tallinn Airport)",
  "finland": "Helsinki, Finland (HEL-Helsinki-Vantaa Airport)",
  "france": "Paris, France (CDG-Charles de Gaulle Airport)",
  "germany": "Berlin, Germany (BER-Brandenburg Airport)",
  "greece": "Athens, Greece (ATH-Eleftherios Venizelos Airport)",
  "hungary": "Budapest, Hungary (BUD-Budapest Ferenc Liszt International)",
  "iceland": "Reykjavik, Iceland (KEF-Keflavík International)",
  "ireland": "Dublin, Ireland (DUB-Dublin Airport)",
  "italy": "Rome, Italy (FCO-Leonardo da Vinci International)",
"kosovo": "Pristina, Kosovo (PRN-Pristina International)",
"latvia": "Riga, Latvia (RIX-Riga International)",
"liechtenstein": "Zurich, Switzerland (ZRH-Zurich Airport)", 
"lithuania": "Vilnius, Lithuania (VNO-Vilnius International)",
"luxembourg": "Luxembourg City, Luxembourg (LUX-Luxembourg Airport)",
"malta": "Malta, Malta (MLA-Malta International)",
"moldova": "Chisinau, Moldova (KIV-Chisinau International)",
"monaco": "Nice, France (NCE-Côte d'Azur International)",
"montenegro": "Podgorica, Montenegro (TGD-Podgorica Airport)",
"netherlands": "Amsterdam, Netherlands (AMS-Schiphol)",
"north macedonia": "Skopje, North Macedonia (SKP-Skopje International)",
"norway": "Oslo, Norway (OSL-Gardermoen Airport)",
"poland": "Warsaw, Poland (WAW-Chopin Airport)",
"portugal": "Lisbon, Portugal (LIS-Humberto Delgado Airport)",
"romania": "Bucharest, Romania (OTP-Henri Coandă International)",
"russia": "Moscow, Russia (SVO-Sheremetyevo International)",
"san marino": "Rimini, Italy (RMI-Federico Fellini International)",
"serbia": "Belgrade, Serbia (BEG-Nikola Tesla Airport)",
"slovakia": "Bratislava, Slovakia (BTS-Bratislava Airport)",
"slovenia": "Ljubljana, Slovenia (LJU-Jože Pučnik Airport)",
"spain": "Madrid, Spain (MAD-Adolfo Suárez Madrid-Barajas Airport)",
"sweden": "Stockholm, Sweden (ARN-Arlanda Airport)",
"switzerland": "Zurich, Switzerland (ZRH-Zurich Airport)",
"turkey": "Istanbul, Turkey (IST-Istanbul Airport)",
"ukraine": "Kyiv, Ukraine (KBP-Boryspil International)",
"united kingdom": "London, United Kingdom (LHR-Heathrow Airport)",
"vatican city": "Rome, Italy (FCO-Leonardo da Vinci International)",
"australia": "Sydney, Australia (SYD-Kingsford Smith Airport)",
"new zealand": "Auckland, New Zealand (AKL-Auckland Airport)",
"fiji": "Nadi, Fiji (NAN-Nadi International)",
"papua new guinea": "Port Moresby, Papua New Guinea (POM-Jacksons International)",
"vanuatu": "Port Vila, Vanuatu (VLI-Bauerfield International)",
"samoa": "Apia, Samoa (APW-Faleolo International)",
"solomon islands": "Honiara, Solomon Islands (HIR-Honiara International)",
"tonga": "Nukuʻalofa, Tonga (TBU-Fuaʻamotu International)",
"tuvalu": "Funafuti, Tuvalu (FUN-Funafuti International)",
"vanuatu": "Port Vila, Vanuatu (VLI-Bauerfield)",
"new york": "New York, United States (JFK-John F. Kennedy International)",
"los angeles": "Los Angeles, United States (LAX-Los Angeles International)",
"chicago": "Chicago, United States (ORD-O'Hare International)",
"miami": "Miami, United States (MIA-Miami International)",
"san francisco": "San Francisco, United States (SFO-San Francisco International)",
"washington dc": "Washington, United States (IAD-Dulles International)",
"washington": "Washington, United States (IAD-Dulles International)",
"london": "London, United Kingdom (LHR-Heathrow Airport)",
"paris": "Paris, France (CDG-Charles de Gaulle Airport)",
"berlin": "Berlin, Germany (BER-Brandenburg Airport)",
"rome": "Rome, Italy (FCO-Fiumicino Airport)",
"madrid": "Madrid, Spain (MAD-Adolfo Suárez Madrid-Barajas Airport)",
"barcelona": "Barcelona, Spain (BCN-Barcelona-El Prat Airport)",
"moscow": "Moscow, Russia (SVO-Sheremetyevo International)",
"tokyo": "Tokyo, Japan (NRT-Narita International)",
"beijing": "Beijing, China (PEK-Beijing Capital International)",
"shanghai": "Shanghai, China (PVG-Pudong International)",
"sydney": "Sydney, Australia (SYD-Kingsford Smith Airport)",
"melbourne": "Melbourne, Australia (MEL-Tullamarine Airport)",
"rio de janeiro": "Rio de Janeiro, Brazil (GIG-Galeão International)",
"são paulo": "São Paulo, Brazil (GRU-Guarulhos International)",
"mexico city": "Mexico City, Mexico (MEX-Benito Juarez International)",
"toronto": "Toronto, Canada (YYZ-Pearson International)",
"vancouver": "Vancouver, Canada (YVR-Vancouver International)",
"montreal": "Montreal, Canada (YUL-Pierre Elliott Trudeau International)",
"buenos aires": "Buenos Aires, Argentina (EZE-Ministro Pistarini International)",
"cape town": "Cape Town, South Africa (CPT-Cape Town International)",
"johannesburg": "Johannesburg, South Africa (JNB-O.R. Tambo International)",
"cairo": "Cairo, Egypt (CAI-Cairo International)",
"dubai": "Dubai, United Arab Emirates (DXB-Dubai International)",
"istanbul": "Istanbul, Turkey (IST-Istanbul Airport)",
"delhi": "Delhi, India (DEL-Indira Gandhi International)",
"mumbai": "Mumbai, India (BOM-Chhatrapati Shivaji Maharaj International)",
"hong kong": "Hong Kong, Hong Kong (HKG-Hong Kong International)",
"bangkok": "Bangkok, Thailand (BKK-Suvarnabhumi Airport)",
"singapore": "Singapore (SIN-Changi International)",
"kuala lumpur": "Kuala Lumpur, Malaysia (KUL-Kuala Lumpur International)",
"jakarta": "Jakarta, Indonesia (CGK-Soekarno Hatta International)",
"seoul": "Seoul, South Korea (ICN-Incheon International)",
"lagos": "Lagos, Nigeria (LOS-Murtala Muhammed International)",
"athens": "Athens, Greece (ATH-Eleftherios Venizelos Airport)",
"vienna": "Vienna, Austria (VIE-Vienna International)",
"stockholm": "Stockholm, Sweden (ARN-Arlanda Airport)",
"oslo": "Oslo, Norway (OSL-Gardermoen Airport)",
"helsinki": "Helsinki, Finland (HEL-Helsinki-Vantaa Airport)",
"warsaw": "Warsaw, Poland (WAW-Chopin Airport)",
"zurich": "Zurich, Switzerland (ZRH-Zurich Airport)",
"brussels": "Brussels, Belgium (BRU-Brussels Airport)",
"amsterdam": "Amsterdam, Netherlands (AMS-Schiphol Airport)",
"dublin": "Dublin, Ireland (DUB-Dublin Airport)",
"copenhagen": "Copenhagen, Denmark (CPH-Kastrup Airport)",
"prague": "Prague, Czech Republic (PRG-Václav Havel Airport)",
  };
  return locationMap[location] || location;
};
app.use(express.json());

    async function scrapeExpediaFlights(req, res) {
      try {
          console.log("Starting Expedia flights scraping...");
          //const { from, to, departureDate, returnDate, passengers } = req.query;
          const url = req.query.url || '';  // Ensure url is defined
          const queryParams = new URLSearchParams(url.split('?')[1]);
          const from = queryParams.get('from');
          const to = queryParams.get('to');
          const departureDate = queryParams.get('departureDate');
          const returnDate = queryParams.get('returnDate');
          const passengers = queryParams.get('passengers');
          const cabinClass = queryParams.get('cabinClass');
          console.log("Parsed Parameters:");
          console.log("From:", from);
          console.log("To:", to);
          console.log("Departure Date:", departureDate);
          console.log("Return Date:", returnDate);
          console.log("Passengers:", passengers);
          console.log("Cabin Class:", cabinClass);

        console.log("Query parameters received:", req.query);
        if (!from || !to) {
          console.error("Missing 'from' or 'to' query parameters.");
          res.status(400).json({ error: "'from' and 'to' parameters are required" });
          return;
      }
      // Map locations to Expedia-compatible formats
      const mappedFrom = locationMapper(from);
      const mappedTo = locationMapper(to);
      const maxRetries = 23;
      let attempts = 0;
      let pageLoaded = false;
  
      let browser, page;
      // ✅ Declare formatDate and formatISODate before using them
      function formatDate(date) {
        const [year, month, day] = date.split("-");
        return `${day}/${month}/${year}`;
      }
  
      function formatISODate(date) {
        const [year, month, day] = date.split("-");
        return `${year}-${month}-${day}`;
      }
      console.log("Mapped locations:");
      console.log("Mapped From:", mappedFrom);
      console.log("Mapped To:", mappedTo);
      const StealthPlugin = require('puppeteer-extra-plugin-stealth');
      puppeteerExtra.use(StealthPlugin());

      while (attempts < maxRetries) {
        try {
          console.log(`🌀 Attempt ${attempts + 1} to start Puppeteer`);
      /*browser = await puppeteerExtra.launch({
        args: [
      '--no-sandbox',
    '--disable-gpu',
    '--disable-setuid-sandbox',
    '--single-process',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=9222',
      '--proxy-server=http://pr.oxylabs.io:7777',  // ✅ Apply proxy
    ],
    //executablePath: await chromium.executablePath || "/usr/bin/chromium-browser",
    headless: true,
    ignoreHTTPSErrors: true,
  });*/
  browser = await launchBrowser2();
      page = await browser.newPage();
      await page.authenticate({
        username: 'JFlock_SMoney_Ghly4',
        password: 'Jesusis14me__120120',
      });
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1.2 Safari/605.1.15',
        // Add more User-Agent strings as needed
      ];
      function getCabinClassUrlParam(cabinClass) {
        const cabinClassMap = {
            "Economy": null,
            "Premium": "premium_economy",
            "Business": "business",
            "1st Class": "first"
        };
    
        return cabinClassMap[cabinClass] || null; // Default to empty string if not found
    }
    const cabinClassParam = getCabinClassUrlParam(cabinClass); // Convert cabin class to valid parameter

      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      await page.setUserAgent(randomUserAgent);
      let searchUrl = `https://www.expedia.co.uk/Flights-Search?
leg1=from:${encodeURIComponent(mappedFrom)}%2Cto:${encodeURIComponent(mappedTo)}%2Cdeparture:${encodeURIComponent(formatDate(departureDate))}TANYT%2CfromType%3AU%2CtoType%3AU
&leg2=from:${encodeURIComponent(mappedTo)}%2Cto:${encodeURIComponent(mappedFrom)}%2Cdeparture:${encodeURIComponent(formatDate(returnDate))}TANYT%2CfromType%3AU%2CtoType%3AU
&mode=search
&options=carrier%3A%2Cmaxhops%3A1%2Cnopenalty%3AN
&pageId=0
&passengers=adults%3A${passengers}%2Cchildren%3A0%2Cinfantinlap%3AN
&trip=roundtrip`;

// **Only add cabinclass if it's NOT Economy**
if (cabinClassParam) {
    searchUrl = searchUrl.replace("&options=carrier%3A", `&options=carrier%3A%2Ccabinclass%3A${encodeURIComponent(cabinClassParam)}`);
}
      
    function formatDate(date) {
      const [year, month, day] = date.split("-");
      return `${day}/${month}/${year}`;
  }
  
  function formatISODate(date) {
      const [year, month, day] = date.split("-");
      return `${year}-${month}-${day}`;
  }



  console.log(`🌍 Navigating to: ${searchUrl} (Attempt ${attempts + 1})`);
  await page.goto(searchUrl, {
    timeout: 60000 // Set timeout to 60 seconds
});
// Wait for flight results to load
await page.waitForSelector('[data-test-id="listings"] li', { timeout: 10000 });
console.log("✅ Flight listings loaded successfully!");
pageLoaded = true;
          break; // Exit retry loop if successful
  
        } catch (error) {
          console.error(`❌ Attempt ${attempts + 1} failed:`, error.message);
  
          await browser.close(); // Close the browser on failure
  
          if (attempts < maxRetries - 1) {
            console.log(`🔄 Restarting Puppeteer... (Attempt ${attempts + 2}/${maxRetries})`);
          } else {
            console.error("🚨 Max retries reached. Unable to load flight results.");
            return res.status(500).json({ error: "Failed to load Expedia flight listings after multiple attempts" });
          }
        }
        attempts++;
      }
  
      if (!pageLoaded) {
        return res.status(500).json({ error: "Could not load Expedia flight listings" });
      }

//await new Promise(resolve => setTimeout(resolve, 10000)); // Allow results to load fully

//page.mouse.move(100, 100);
//page.mouse.click(100, 100);
/*        await page.evaluate(() => {
            // CJ Deep Link bookmarklet code
            console.log("Injecting CJ Deep Link bookmarklet...");
            (function() {
                document.body.appendChild(
                    document.createElement('script')
                ).src = 'https://members.cj.com/member/publisherBookmarklet.js?version=1';
            })();
        });
        
        // Wait for the overlay or topmost layer to be visible
console.log("Waiting for the overlay to become visible...");
//await page.waitForSelector('div.overlay', { visible: true });
console.log("Overlay is visible.");

// Find all input fields on the page
console.log("Searching for input fields...");
const inputFields = await page.$$('input');
console.log(`Found ${inputFields.length} input fields.`);

try {
  console.log("Searching for the input field with id 'username'...");
  const usernameField = await page.$('#username'); // Selects the input field by id 'username'
  if (usernameField) {
    console.log("Clicking on the username field...");
    await usernameField.click();
    console.log("Typing email into the username field...");
    await usernameField.type('shangefagan@gmail.com'); // Types the username
  } else {
    console.error("Username input field with id 'username' not found!");
  }

  console.log("Searching for the input field with id 'password'...");
  const passwordField = await page.$('#password'); // Selects the input field by id 'password'
  if (passwordField) {
    console.log("Clicking on the password field...");
    await passwordField.click();
    console.log("Typing password into the password field...");
    await passwordField.type('Jesusis14me__120'); // Types the password
  } else {
    console.error("Password input field with id 'password' not found!");
  }

  console.log("All input fields processed successfully.");
} catch (error) {
  console.error("An error occurred while interacting with the input fields:", error.message);
}

// Click the submit button
console.log("Looking for the submit button...");
await page.waitForSelector('button[type="submit"]', { visible: true });
console.log("Submit button found. Clicking the submit button...");
await page.click('button[type="submit"]');

console.log("Login process completed.");
//await new Promise(resolve => setTimeout(resolve, 10000)); // Adjust delay based on how long the CJ script takes

let captchaResolved = false; // Track whether CAPTCHA was resolved
let attempts = 0; // Track retries
const maxAttempts = 5; // Maximum retries to avoid infinite loops

while (!captchaResolved && attempts < maxAttempts) {
    console.log(`Attempt ${attempts + 1} to solve CAPTCHA...`);

    // Check if flight results are already available
    const flightResults = await page.$('[data-test-id="listings"] li');
    if (flightResults) {
        console.log("Flight results detected. Skipping CAPTCHA and proceeding...");
        captchaResolved = true;
        break;
    }

    let pageLoaded = false; // Track when the page has fully loaded
    let retryCount = 0; // Track retry attempts

    // Check for "Retry" button and attempt click
    const retryButton = await page.$('.uitk-button.uitk-button-medium.uitk-button-has-text.uitk-button-primary');

    if (retryButton) {
        console.log(`Retry button found. Clicking it... Attempt ${retryCount + 1}`);
        await page.evaluate(el => el.scrollIntoView(), retryButton);
        await page.waitForTimeout(500);

        const isClickable = await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        }, retryButton);

        if (isClickable) {
            await retryButton.click();
        } else {
            console.log("Retry button is not clickable. Trying JS click...");
            await page.evaluate(button => button.click(), retryButton);
        }

        retryCount++;
        await page.waitForSelector('[data-test-id="listings"] li', { visible: true, timeout: 10000 });
        console.log("Page loaded successfully!");
        pageLoaded = true;
        break;
    }

    console.log("Exiting retry loop. Page has loaded or retries stopped.");

    // **Use XPath with `document.evaluate()` instead of `page.$x()`**
    const startPuzzleButton = await page.$('button:has-text("Start Puzzle")');

if (startPuzzleButton) {
    const isVisible = await page.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }, startPuzzleButton);

    if (isVisible) {
        console.log("CAPTCHA detected. Starting puzzle...");
        await startPuzzleButton.click();
    }

        try {
            await solveCaptcha(page); // Call your CAPTCHA solving function
            captchaResolved = true; // Mark as resolved
        } catch (error) {
            console.error("Error solving CAPTCHA:", error);
        }
    } else {
        console.log("No 'Start Puzzle' button detected. Checking fallback text...");

        // **NEW CHECK**: Look for the CAPTCHA fallback message
        const captchaText = await page.evaluate(() => {
            const element = document.querySelector('.uitk-paragraph.uitk-paragraph-2');
            return element ? element.innerText : null;
        });

        if (captchaText && captchaText.includes("We can't tell if you're a human or a bot.")) {
            console.log("CAPTCHA message detected. Refreshing page...");
            try {
                await page.reload({ waitUntil: 'networkidle2' });
                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for reload
            } catch (reloadError) {
                console.error("Page reload failed:", reloadError);
                break; // Exit loop if reload fails
            }
            attempts++;
        } else {
            console.log("No CAPTCHA or fallback text detected. Proceeding...");
            captchaResolved = true; // Proceed if neither CAPTCHA nor fallback message is found
        }
    }
}

if (!captchaResolved) {
    console.error("Failed to resolve CAPTCHA after maximum attempts.");
    await page.screenshot({ path: 'captcha_fail.png' });
    // Optionally, throw an error or handle this case
}


// Your scraping logic goes here after CAPTCHA is solved
//await new Promise(resolve => setTimeout(resolve, 22000)); // Adjust delay based on how long the CJ script takes
*/ 
const results = await page.evaluate(() => {
  const flights = [];

  // Query all flight listings
  const ticketItems = document.querySelectorAll('[data-test-id="listings"] li');

  ticketItems.forEach((item) => {
      const airline = Array.from(
          item.querySelectorAll('.uitk-text.uitk-type-200.uitk-text-secondary-theme')
      )[1]?.innerText || "N/A";

      const airlineImg = item.querySelector('img.uitk-mark.uitk-layout-grid-item.uitk-mark-landscape-oriented')
          ?.getAttribute('src') || "N/A";

      const times = Array.from(item.querySelectorAll('.uitk-text.uitk-type-400.uitk-text-default-theme'));
      const departureTime = times[0]?.innerText || "N/A";
      const returnTime = times[1]?.innerText || "N/A";

      const layoverTime = item.querySelector('.uitk-text.uitk-type-300.uitk-type-medium')?.innerText || "N/A";
      const price = item.querySelector('.uitk-lockup-price')?.innerText || "N/A";

      // ✅ Attempt multiple ways to extract the flight booking link
      let link = window.location.href; // Use the original Expedia search URL by default

      // **Option 1:** Try extracting a direct flight booking link
      const button = item.querySelector('.uitk-card-link');
      if (button) {
          link = button.getAttribute('data-url') || button.getAttribute('data-href') || link;
      }

      // **Option 2:** Check if there's an <a> tag inside the listing
      if (link === window.location.href) {
          link = item.closest('a')?.href || link;
      }

      // **Append CJ Affiliate Tracking**
      if (link !== "N/A") {
          const baseAffiliateURL = "https://www.tkqlhce.com/click-101312981-13882988?url=";
          const encodedURL = encodeURIComponent(link);
          link = `${baseAffiliateURL}${encodedURL}`;
      }


      console.log("Extracted Flight Link:", link);

      // Append CJ Affiliate Tracking if link is available
      if (link !== "N/A") {
          const baseAffiliateURL = "https://www.tkqlhce.com/click-101312981-13882988?url=";
          const encodedURL = encodeURIComponent(link);
          link = `${baseAffiliateURL}${encodedURL}`;
      }

      if (airline !== "N/A" && price !== "N/A" && airlineImg !== "N/A") {
          flights.push({
              airline,
              airlineImg,
              departureTime,
              returnTime,
              layoverTime,
              price,
              link
          });
      }
  });

  return flights;
});


  
  console.log(`🌍 Scraped ${results.length} flights! flights: ${JSON.stringify(results, null, 2)}`);
  
  // Close the browser
  await browser.close();
  
      // Return scraped data
      res.json({ success: true, flights: results });
    } catch (error) {
      console.error("Error scraping flights:", error);
      res.status(500).json({ success: false, error: "Failed to scrape flights" });
    }
  };
  app.get("/scrape-expedia-flights", scrapeExpediaFlights);


  /*app.get('/scrape-expedia-flights', async (req, res) => {
    try {
      console.log("Starting Expedia flights scraping...");
      const url = req.query.url || '';
      const queryParams = new URLSearchParams(url.split('?')[1]);
      const from = queryParams.get('from');
      const to = queryParams.get('to');
      const departureDate = queryParams.get('departureDate');
      const returnDate = queryParams.get('returnDate');
      const passengers = queryParams.get('passengers');
      const cabinClass = queryParams.get('cabinClass');
  
      if (!from || !to) {
        console.error("Missing 'from' or 'to' query parameters.");
        return res.status(400).json({ error: "'from' and 'to' parameters are required" });
      }
  
      const mappedFrom = locationMapper(from);
      const mappedTo = locationMapper(to);
      const maxRetries = 7;
      let attempts = 0;
      let pageLoaded = false;
  
      let browser, page;
  
      // ✅ Declare formatDate and formatISODate before using them
      function formatDate(date) {
        const [year, month, day] = date.split("-");
        return `${day}/${month}/${year}`;
      }
  
      function formatISODate(date) {
        const [year, month, day] = date.split("-");
        return `${year}-${month}-${day}`;
      }
  
      while (attempts < maxRetries) {
        try {
          console.log(`🌀 Attempt ${attempts + 1} to start Puppeteer`);
          browser = await puppeteerExtra.launch({
            executablePath: await chromium.executablePath,
            headless: false,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-web-security',
              '--allow-running-insecure-content',
              '--disable-features=IsolateOrigins,site-per-process',
              '--proxy-server=http://pr.oxylabs.io:7777',
            ],
            userDataDir: './user-data',
          });
  
          page = await browser.newPage();
          await page.authenticate({
            username: 'JFlock_SMoney_Ghly4',
            password: 'Jesusis14me__120120',
          });
  
          const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1.2 Safari/605.1.15',
          ];
          
          const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
          await page.setUserAgent(randomUserAgent);
  
          const searchUrl = `https://www.expedia.co.uk/Flights-Search?flight-type=on&mode=search&trip=roundtrip
            &leg1=from:${mappedFrom},to:${mappedTo},departure:${formatDate(departureDate)}TANYT,fromType:METROCODE,toType:AIRPORT
            &leg2=from:${mappedTo},to:${mappedFrom},departure:${formatDate(returnDate)}TANYT,fromType:AIRPORT,toType:METROCODE
            &options=cabinclass:economy
            &fromDate=${formatDate(departureDate)}
            &toDate=${formatDate(returnDate)}
            &d1=${formatISODate(departureDate)}
            &d2=${formatISODate(returnDate)}
            &passengers=adults:${passengers},infantinlap:N`;
  
          console.log(`🌍 Navigating to: ${searchUrl} (Attempt ${attempts + 1})`);
          await page.goto(searchUrl, { timeout: 60000 });
  
          // Wait for flight listings
          await page.waitForSelector('[data-test-id="listings"] li', { timeout: 20000 });
          console.log("✅ Flight listings loaded successfully!");
          pageLoaded = true;
          break; // Exit retry loop if successful
  
        } catch (error) {
          console.error(`❌ Attempt ${attempts + 1} failed:`, error.message);
  
          await browser.close(); // Close the browser on failure
  
          if (attempts < maxRetries - 1) {
            console.log(`🔄 Restarting Puppeteer... (Attempt ${attempts + 2}/${maxRetries})`);
          } else {
            console.error("🚨 Max retries reached. Unable to load flight results.");
            return res.status(500).json({ error: "Failed to load Expedia flight listings after multiple attempts" });
          }
        }
        attempts++;
      }
  
      if (!pageLoaded) {
        return res.status(500).json({ error: "Could not load Expedia flight listings" });
      }
  
      // Wait for full page load
      await new Promise(resolve => setTimeout(resolve, 10000));
  
      // Scrape flights
      const results = await page.evaluate(() => {
        const flights = [];
        
        // Query all tickets with `role="ticket-container"`
        const ticketItems = document.querySelectorAll('[data-test-id="listings"] li');
        
        ticketItems.forEach((item) => {
          const airline = Array.from(
            item.querySelectorAll('.uitk-text.uitk-type-200.uitk-text-secondary-theme')
        )[1]?.innerText || "N/A"; // Second instance (airline)
          const airlineImg = item.querySelector('img.uitk-mark.uitk-layout-grid-item.uitk-mark-landscape-oriented')?.getAttribute('src') || "N/A"; // Airline image
          // Handle departure and return times
          const times = Array.from(item.querySelectorAll('.uitk-text.uitk-type-400.uitk-text-default-theme'));
          const departureTime = times[0]?.innerText || "N/A"; // First occurrence
          const returnTime = times[1]?.innerText || "N/A"; // Second occurrence
        const layoverTime = Array.from(
          item.querySelectorAll('.uitk-text.uitk-type-300.uitk-type-medium.uitk-text-default-theme')
      )[0]?.innerText || "N/A"; // Second instance (airline)
      //const layoverTime = Array.from(
        //item.querySelectorAll('.uitk-text.uitk-type-300.uitk-type-medium.uitk-text-default-theme')
    //).find((element) => /hr|min/.test(element.innerText))?.innerText || "N/A";
          const price = item.querySelector('.uitk-lockup-price')?.innerText || "N/A";
          let link = item.querySelector('.ticket-action-button-deeplink.ticket-action-button-deeplink--')?.href || "N/A";
      // **Append CJ Affiliate Tracking**
      if (link !== "N/A") {
        const baseAffiliateURL = "https://www.tkqlhce.com/click-101312981-13882988?url=";
        const encodedURL = encodeURIComponent(link);
        link = `${baseAffiliateURL}${encodedURL}`;
      }
          flights.push({
            airline,
            airlineImg,
            departureTime,
            returnTime,
            price,
            link
          });
        });
        console.log(`Response:, ${flights}`);
        return flights;
      });
      console.log('Fetching flights from:', `https://bc65-2a02-c7c-3945-5100-856b-1b14-fb41-1e2c.ngrok-free.app/scrape-expedia-flights?url=${encodeURIComponent(url)}`);

      console.log(`🌍 Scraped ${results.length} flights! flights: ${JSON.stringify(results, null, 2)}`);
      
      // Close the browser
      await browser.close();
      
          // Return scraped data
          res.json({ success: true, flights: results });
        } catch (error) {
          console.error("Error scraping flights:", error);
          res.status(500).json({ success: false, error: "Failed to scrape flights" });
        }
      });*/
  

//app.use(express.json());

/*app.get('/scrape-expedia-posts', async (req, res) => {
    const { expediasearchUrl } = req.query;

    if (!expediasearchUrl) {
        return res.status(400).json({ error: "Missing Expedia search URL" });
    }

    console.log("Starting Puppeteer to scrape:", expediasearchUrl);

    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteerExtra.use(StealthPlugin());
    console.log("Starting Puppeteer to scrape:", expediasearchUrl);
    const maxRetries = 3;
    let attempts = 0;
    let pageLoaded = false;
    
    while (attempts < maxRetries) {
      try {
        console.log(`🌀 Attempt ${attempts + 1} to start Puppeteer`);
    const browser = await puppeteerExtra.launch({
      executablePath: await chromium.executablePath,
      headless: false, // or false for debugging
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-features=IsolateOrigins,site-per-process',
        '--proxy-server=http://pr.oxylabs.io:7777',
      ],
      //userDataDir: './user-data', // Ensures Chrome profile and settings are saved
    });
    const page = await browser.newPage();
    await page.authenticate({
      username: 'JFlock_SMoney_Ghly4',
      password: 'Jesusis14me__120120',
    });
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1.2 Safari/605.1.15',
      // Add more User-Agent strings as needed
    ];
    
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    await page.setUserAgent(randomUserAgent);
    

      await page.goto(expediasearchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log("🌍 Navigating to:", expediasearchUrl);
      
        // Wait for hotel listings to load
        await page.waitForSelector('[data-stid="property-listing-results"]', { timeout: 20000 });
        console.log("✅ Page loaded successfully!");
        pageLoaded = true;
        break;  // Exit loop if page loads successfully

      } catch (error) {
        console.error(`❌ Attempt ${attempts + 1} failed to load hotel listings:`, error.message);
        
        if (attempts < maxRetries - 1) {
            console.log(`🔄 Reloading page... (Attempt ${attempts + 2}/${maxRetries})`);
            await page.reload({ waitUntil: 'networkidle2' });
        } else {
            console.error("🚨 Max retries reached. Unable to load listings.");
            return res.status(500).json({ error: "Failed to load Expedia listings after multiple attempts" });
        }
    }

    attempts++;
}

if (!pageLoaded) {
    return res.status(500).json({ error: "Could not load Expedia listings" });
}

await page.evaluate(async () => {
  async function smoothScrollToBottom() {
      const distance = 500; // Adjust the scroll step (px)
      const delay = 500; // Adjust the delay (ms) between scrolls
      let totalHeight = 0;

      while (totalHeight < document.body.scrollHeight) {
          window.scrollBy(0, distance);
          totalHeight += distance;
          await new Promise(resolve => setTimeout(resolve, delay)); // Wait for content to load
      }
  }

  await smoothScrollToBottom();
});
        // Scrape hotel listings
// Scrape the post elements (titles, images, prices, etc.)
const cjAffiliateBaseURL = "https://www.tkqlhce.com/click-101312981-13882988?url="; // CJ Affiliate Base
await page.waitForSelector('.uitk-gallery-carousel-item-current figure img.uitk-image-media', { timeout: 30000 });
await new Promise(resolve => setTimeout(resolve, 10000)); // Adjust delay based on how long the CJ script takes

const posts2 = await page.evaluate((cjAffiliateBaseURL) => {
  const postElements = [...document.querySelectorAll('.uitk-spacing.uitk-spacing-margin-blockstart-three')];

  return postElements.slice(1).map(post => { // Exclude first element
      const title = post.querySelector('.uitk-heading.uitk-heading-5')?.innerText || 'No Title';
      const subtitle = post.querySelector('.uitk-text.uitk-text-spacing-half.truncate-lines-2.uitk-type-300')?.innerText || 'No Subtitle';
      const listing_name = post.querySelector('.uitk-text.uitk-text-spacing-half.truncate-lines-2.uitk-type-300')?.innerText || 'No Listing Name';
      const rawLink = post.querySelector('[data-stid="open-hotel-information"]')?.href || '#';
      const imageElements = post.querySelectorAll('.uitk-gallery-carousel-item-current figure img.uitk-image-media');
      const images = imageElements.length > 0 ? [...imageElements].map(img => img.src) : ['No Image'];
      const rating_out_of_5_stars = post.querySelector('.uitk-badge-base-text')?.innerText || 'N/A';
      const listing_price_details = post.querySelector('.uitk-text.uitk-type-300.uitk-text-default-theme.is-visually-hidden')?.innerText || 'No Price Info';

      // Encode Expedia URL and append to CJ Affiliate base
      const affiliateLink = rawLink !== '#' ? `${cjAffiliateBaseURL}${encodeURIComponent(rawLink)}` : '#';

      return {
        images: images,
        title: title,
        subtitle: subtitle,
        listing_name: listing_name,
        listing_price_details: listing_price_details,
        rating_out_of_5_stars: rating_out_of_5_stars,
        link: affiliateLink // Now using CJ Affiliate link
      };
  }).filter(post => !( // Exclude posts with missing data
    post.title === '' &&
    post.subtitle === '' &&
    post.listing_name === '' &&
    post.listing_price_details === ''
));
}, cjAffiliateBaseURL);

console.log(`🛏️ Scraped ${posts2.length} hotel listings with affiliate links`);
return res.json({ posts2 });

});*/
async function scrapeExpediaPosts(req, res) {
  const { expediasearchUrl } = req.query;

  if (!expediasearchUrl) {
      return res.status(400).json({ error: "Missing Expedia search URL" });
  }

  console.log("Starting Puppeteer to scrape:", expediasearchUrl);

  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteerExtra.use(StealthPlugin());

  const maxRetries = 23;
  let attempts = 0;
  let pageLoaded = false;
  let browser, page; // Declare browser & page globally

  while (attempts < maxRetries) {
      try {
          console.log(`🌀 Attempt ${attempts + 1} to start Puppeteer`);

          // Ensure previous instance is closed before starting new one
          if (browser) await browser.close();

          // **Launch Puppeteer**
          /*browser = await puppeteerExtra.launch({
              args: [
        '--no-sandbox',
    '--disable-gpu',
    '--disable-setuid-sandbox',
    '--single-process',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=9222',
      '--proxy-server=http://pr.oxylabs.io:7777',  // ✅ Apply proxy
    ],
    //executablePath: await chromium.executablePath || "/usr/bin/chromium-browser",
    headless: true,
    ignoreHTTPSErrors: true,
  });*/
  browser = await launchBrowser2();
          page = await browser.newPage();
          await page.authenticate({
              username: 'JFlock_SMoney_Ghly4',
              password: 'Jesusis14me__120120',
          });

          const userAgents = [
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1.2 Safari/605.1.15',
          ];

          await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
          await page.goto(expediasearchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

          console.log("🌍 Navigating to:", expediasearchUrl);

          // **Wait for hotel listings to load**
          await page.waitForSelector('[data-stid="property-listing-results"]', { timeout: 35000 });
          console.log("✅ Page loaded successfully!");
          pageLoaded = true;
          break; // Exit retry loop on success

      } catch (error) {
          console.error(`❌ Attempt ${attempts + 1} failed: ${error.message}`);

          if (attempts < maxRetries - 1) {
              console.log(`🔄 Restarting Puppeteer... (Attempt ${attempts + 2}/${maxRetries})`);
          } else {
              console.error("🚨 Max retries reached. Unable to load listings.");
              return res.status(500).json({ error: "Failed to load Expedia listings after multiple attempts" });
          }
      }
      attempts++;
  }

  if (!pageLoaded) {
      return res.status(500).json({ error: "Could not load Expedia listings" });
  }

  // **New Optimized Scroll Function**
  await page.evaluate(async () => {
    async function smoothScrollToBottom() {
        const distance = 400; // Scroll step (px)
        const delay = 700; // Delay (ms) between scrolls
        let totalHeight = 0;
        const maxScrolls = 50; // Limit max scroll attempts

        while (totalHeight < document.body.scrollHeight && maxScrolls > 0) {
            window.scrollBy(0, distance);
            totalHeight += distance;
            await new Promise(resolve => setTimeout(resolve, delay));

            // Wait for images to load after scrolling
            const images = document.querySelectorAll('img.uitk-image-media');
            images.forEach(img => {
                if (!img.complete || img.naturalHeight === 0) {
                    console.log("⏳ Waiting for images to load...");
                    setTimeout(() => {}, 2000); 
                }
            });
        }
    }

    await smoothScrollToBottom();
});

  await page.waitForSelector('.uitk-gallery-carousel-item-current figure img.uitk-image-media', { timeout: 77000 });

  //await new Promise(resolve => setTimeout(resolve, 10000));

  // **Scrape Hotel Listings**
  const cjAffiliateBaseURL = "https://www.tkqlhce.com/click-101312981-13882988?url=";

  const posts2 = await page.evaluate((cjAffiliateBaseURL) => {
      const postElements = [...document.querySelectorAll('.uitk-spacing.uitk-spacing-margin-blockstart-three')];

      return postElements.slice(1).map(post => { 
          const title = post.querySelector('.uitk-heading.uitk-heading-5')?.innerText || 'No Title';
          const subtitle = post.querySelector('.uitk-text.uitk-text-spacing-half.truncate-lines-2.uitk-type-300')?.innerText || 'No Subtitle';
          const listing_name = post.querySelector('.uitk-text.uitk-text-spacing-half.truncate-lines-2.uitk-type-300')?.innerText || 'No Listing Name';
          const rawLink = post.querySelector('[data-stid="open-hotel-information"]')?.href || '#';
          const imageElements = post.querySelectorAll('.uitk-gallery-carousel-item-current figure img.uitk-image-media');
          const images = imageElements.length > 0 ? [...imageElements].map(img => img.src) : ['No Image'];
          const rating_out_of_5_stars = post.querySelector('.uitk-badge-base-text')?.innerText || 'N/A';
          const listing_price_details = post.querySelector('.uitk-text.uitk-type-300.uitk-text-default-theme.is-visually-hidden')?.innerText || 'No Price Info';

          const affiliateLink = rawLink !== '#' ? `${cjAffiliateBaseURL}${encodeURIComponent(rawLink)}` : '#';

          return {
              images: images,
              title: title,
              subtitle: subtitle,
              listing_name: listing_name,
              listing_price_details: listing_price_details,
              rating_out_of_5_stars: rating_out_of_5_stars,
              link: affiliateLink
          };
      }).filter(post => 
        post.title !== '' &&  // Ensure title exists
        post.images.length > 0 && // Ensure at least one image exists
        post.images.some(img => img && img !== 'No Image') // Remove broken images
    );
  }, cjAffiliateBaseURL);

  console.log(`🛏️ Scraped ${posts2.length} hotel listings with affiliate links`);

  await browser.close();
  return res.json({ posts2 });

};
app.get("/scrape-expedia-posts", scrapeExpediaPosts);


// Route to scrape flight data
app.get("/scrape-flights", async (req, res) => {
  const url = req.query.url || '';  // Ensure url is defined
const queryParams = new URLSearchParams(url.split('?')[1]);
const from = queryParams.get('from');
const to = queryParams.get('to');
const departureDate = queryParams.get('departureDate');
const returnDate = queryParams.get('returnDate');
const passengers = queryParams.get('passengers');
const cabinClass = queryParams.get('cabinClass');

console.log("Parsed Parameters:");
    console.log("From:", from);
    console.log("To:", to);
    console.log("Departure Date:", departureDate);
    console.log("Return Date:", returnDate);
    console.log("Passengers:", passengers);
    console.log("Cabin Class:", cabinClass);

  console.log("Query parameters received:", req.query);
  if (!from || !to) {
    console.error("Missing 'from' or 'to' query parameters.");
    res.status(400).json({ error: "'from' and 'to' parameters are required" });
    return;
}
  try {
    const url = `https://www.trivagoflight.in/flights/`;

  console.log("Generated URL:", url);

  // Launch Puppeteer
  // Launch Puppeteer with stealth mode enabled
  const browser = await puppeteerExtra.launch({
    //executablePath: await chromium.executablePath || "/usr/bin/chromium-browser",
    headless: true, // or false for debugging
    args: [
      '--no-sandbox',
    '--disable-gpu',
    '--disable-setuid-sandbox',
    '--single-process',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=9222',
    ]
  });
  const page = await browser.newPage();

  // Navigate to Trivago Flights main page
  // Navigate to the Airbnb search results page
  await navigateToPageWithRetry(page, url);


  await page.setViewport({ width: 1280, height: 720 });
  // Wait for results to load
await new Promise(resolve => setTimeout(resolve, 5000));
console.log('Waited for 10 seconds to load results.');
  // Define the selector for the input field
const fromInputSelector = 'input[placeholder="Origin"]'; // Replace with your actual selector

// Use page.evaluate to clear the input field
await page.evaluate((selector) => {
  const input = document.querySelector(selector);
  if (input) {
    input.value = ''; // Clear the input field programmatically
    input.dispatchEvent(new Event('input', { bubbles: true })); // Trigger input event to ensure UI updates
  }
}, fromInputSelector);

// Type the new "From" value
await page.type(fromInputSelector,(from)); // Replace 'London' with your desired value
console.log(`Entered "${from}" as the from location.`);

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Input "To" field
  await page.click('input[placeholder="Destination"]'); // Use the actual selector
  await page.keyboard.type(to); // Type the "To" value
  console.log(`Entered "${to}" as the destination city.`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Function to select a specific date by clicking the calendar cell
async function selectDate(page, date) {
  const dateSelector = '.mewtwo-datepicker-table'; // Calendar table container class
  const dateCellSelector = `td[data-date="${date}"]`; // Dynamic selector for the specific date

  // Wait for the calendar table to appear
  await page.waitForSelector(dateSelector);

  // Click on the date cell
  await page.evaluate((selector) => {
    const dateCell = document.querySelector(selector);
    if (dateCell) {
      dateCell.click(); // Simulate a click on the desired date
    }
  }, dateCellSelector);

  console.log(`Selected date: ${date}`);
}
  // Input "Departure Date"
  await page.click('input[placeholder="Depart date"]'); // Use the actual selector
await selectDate(page, departureDate);
  console.log(`Selected "${departureDate}" as the departure date.`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Define the coordinates of the blank part of the page (adjust as per your page layout)
const blankPartX = 200; // X coordinate of the blank space
const blankPartY = 500; // Y coordinate of the blank space

// Click the blank part of the page
// Select a blank part of the page by a safe selector (for example, the body or a specific div with no functionality)
const clickAwaySelector =  '.TPWL-header-content'
await page.waitForSelector(clickAwaySelector, { visible: true });
// Click the passenger selection button
await page.evaluate((selector) => {
  const button = document.querySelector(selector);
  if (button) {
    button.click();
  }
}, clickAwaySelector);
console.log('Clicked on the blank part of the page to ensure proper date selection.');
await new Promise(resolve => setTimeout(resolve, 5000));

  // Input "Return Date"
  await page.click('input[placeholder="Return date"]'); // Use the actual selector
  await selectDate(page, returnDate);
  console.log(`Selected "${returnDate}" as the return date.`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Wait for the page to load and target the passenger selection button
const passengerButtonSelector = '.mewtwo-flights-trip_class-wrapper'; // Button to open the passenger modal
await page.waitForSelector(passengerButtonSelector, { visible: true });

// Click the passenger selection button
await page.evaluate((selector) => {
  const button = document.querySelector(selector);
  if (button) {
    button.click();
  }
}, passengerButtonSelector);
console.log('Clicked the passenger selection button.');

// Ensure the modal is fully opened (add a delay if necessary)
await new Promise(resolve => setTimeout(resolve, 5000));
// Wait for the page to load and target the passenger selection button
// Wait for the page to load and target the passenger selection button

// Selector for the "Add Passenger" button
const incrementPassengersSelector = '.mewtwo-popup-ages-counter__plus';
await page.waitForSelector(incrementPassengersSelector, { visible: true });

// Increment passenger count to the desired number
const passengersToAdd = passengers - 1; // Number of passengers to add (current passengers - 1)
for (let i = 0; i < passengersToAdd; i++) {
  await page.evaluate((selector) => {
    const button = document.querySelector(selector);
    if (button) {
      button.click();
    }
  }, incrementPassengersSelector);
  console.log(`Added passenger ${i + 1}`);
}

console.log('Incremented the passenger count.');



// Select a blank part of the page by a safe selector (for example, the body or a specific div with no functionality)
await page.waitForSelector(clickAwaySelector, { visible: true });
// Click the passenger selection button
await page.evaluate((selector) => {
  const button = document.querySelector(selector);
  if (button) {
    button.click();
  }
}, clickAwaySelector);
console.log('Clicked on the blank part of the page to ensure proper date selection.');

try {
  // Log the cabin class for debugging
  console.log('Cabin class received:', cabinClass);

  // Select the Business Class checkbox if needed
  if (cabinClass === 'business') {
    const businessClassCheckboxSelector = '.mewtwo-passengers-flight_type__checkbox'; // Update based on the actual selector
    await page.waitForSelector(businessClassCheckboxSelector, { visible: true }); // Wait for the checkbox to be visible

    const isChecked = await page.evaluate((selector) => {
      const checkbox = document.querySelector(selector);
      return checkbox ? checkbox.checked : false; // Ensure checkbox exists before checking
    }, businessClassCheckboxSelector);

    if (!isChecked) {
      await page.click(businessClassCheckboxSelector); // Check the Business Class box
      console.log('Selected Business Class.');
    } else {
      console.log('Business Class already selected.');
    }
  } else {
    console.log('Economy Class selected by default.');
  }

  // Proceed to click the search button
  const searchButtonSelector = '.mewtwo-flights-submit_button.mewtwo-flights-submit_button--new'; // Ensure the selector is correct
  await page.waitForSelector(searchButtonSelector, { visible: true }); // Wait for the button to be visible
  await page.screenshot({ path: 'screenshot-before-searchbtn.png' });
  await page.click(searchButtonSelector);
  //await new Promise(resolve => setTimeout(resolve, 35000));

//await new Promise(resolve => setTimeout(resolve, 5000));
const currentUrlBeforeSearch = page.url();
// Capture HTML content to check if reCAPTCHA is present
console.log("Current URL before pressing the search button:", currentUrlBeforeSearch);
 // Check if CAPTCHA is present
 /*const captchaFrame = await page.$('iframe[src*="recaptcha"]');
 if (captchaFrame) {
   console.log("CAPTCHA detected, solving...");
   await solveRecaptcha(page, captchaFrame);
 }*/
  //await page.click(searchButtonSelector);  // After solving the CAPTCHA, click the search button
  console.log('Search button clicked.');
} catch (error) {
  console.error('Error handling cabin class or clicking search button:', error);
}

await new Promise(resolve => setTimeout(resolve, 15000));

// Wait for the flight results container to load
// Wait for the tickets container to load
await page.waitForSelector('.tickets-container.js-tickets-container', { timeout: 60000 });
await page.screenshot({ path: 'screenshot-before-search.png' });
// Scrape flight data for all tickets
const results = await page.evaluate(() => {
  const flights = [];
  
  // Query all tickets with `role="ticket-container"`
  const ticketItems = document.querySelectorAll('[role="ticket-container"]');
  
  ticketItems.forEach((item) => {
    const airline = item.querySelector('.ticket-action__main_proposal')?.innerText || "N/A";
    const airlineImg = item.querySelector('img.ticket-action-airline__logo.ticket-action-airline__logo--not_mobile')?.getAttribute('src') 
    const departureTime = item.querySelector('.flight.flight--depart .flight-brief-departure .flight-brief-time')?.innerText || "N/A";
    const returnTime = item.querySelector('.flight.flight--return .flight-brief-departure .flight-brief-time')?.innerText || "N/A";
    const layoverTime = item.querySelector('.flight-brief-layovers__flight_time')?.innerText || "N/A";
    const price = item.querySelector('.currency_font.currency_font--usd')?.innerText || "N/A";
    const link = item.querySelector('.ticket-action-button-deeplink.ticket-action-button-deeplink--')?.href || "N/A";

    flights.push({
      airline,
      airlineImg,
      departureTime,
      returnTime,
      layoverTime,
      price,
      link,
    });
  });

  return flights;
});

console.log("Scraped flight results:", results);

// Close the browser
await browser.close();


    // Return scraped data
    res.json({ success: true, flights: results });
  } catch (error) {
    console.error("Error scraping flights:", error);
    res.status(500).json({ success: false, error: "Failed to scrape flights" });
  }
});

// Airbnb Scraping based on searchUrl (Original code)
async function scrapeAirbnbPosts(searchUrl) {
  try {
    /*const browser = await chromium.puppeteer.launch({
      args: [...chromium.args,'--no-sandbox',
    '--disable-gpu',
    '--disable-setuid-sandbox',
    '--single-process',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=9222'],
      //executablePath: await chromium.executablePath || "/usr/bin/chromium-browser",
      headless: true, // or false for debugging
      ignoreHTTPSErrors: true,
    });*/
    const browser = await launchBrowser();

    
    const page = await browser.newPage();

    // Navigate to the Airbnb search results page
    await navigateToPageWithRetry(page, searchUrl);

  
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['stylesheet', 'font'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });
    // Scrape the post elements (titles, images, prices, etc.)
    const posts2 = await page.evaluate(() => {
      const postElements = [...document.querySelectorAll('[data-testid="listing-card-title"]')].map((post, index) => {
        const subtitleElement = document.querySelectorAll('[data-testid="listing-card-subtitle"]')[index];
        const subtitleNameElement = document.querySelectorAll('[data-testid="listing-card-name"]')[index];
        const priceElement = document.querySelectorAll('[data-testid="price-availability-row"]')[index];
        // Select only the first image from the listing carousel
        const imgElement = document.querySelectorAll('picture source[srcset]')[index];
        const imageUrl = imgElement ? imgElement.getAttribute('srcset').split(' ')[0] : '';
        // Fetch the correct hyperlink for each post
    const postCardElement = post.closest('[data-testid="card-container"]'); // Narrow down to the parent card
    const linkElement = postCardElement ? postCardElement.querySelector('a[aria-hidden="true"]') : null;
        //const linkElement = document.querySelectorAll('a[aria-hidden="true"]')[index];
        const ratingElement = document.querySelectorAll('.t1a9j9y7.atm_da_1ko3t4y.atm_dm_kb7nvz.atm_fg_h9n0ih.dir.dir-ltr')[index];

        // Extract and clean the price
    const listingPriceDetails = priceElement?.textContent?.trim() || '';
    const priceMatch = listingPriceDetails.match(/£\d+/); // Extract only the first number with £
    const cleanedPrice = priceMatch ? priceMatch[0] : 'N/A';

    // Extract and clean the rating text to display only "4.91 out of 5"
    const ratingDetails = ratingElement?.textContent || '';
    const cleanedRating = ratingDetails.match(/[\d.]+\sout\s(of)\s5/)?.[0] || 'N/A'; // Extract only "4.91 out of 5"

        return {
          images: imageUrl,
          title: post.innerText,
          subtitle: subtitleElement ? subtitleElement.innerText : null,
          listing_name: subtitleNameElement ? subtitleNameElement.innerText : null,
          listing_price_details: cleanedPrice ? cleanedPrice : null,
          rating_out_of_5_stars: cleanedRating ? cleanedRating : null,
          link: linkElement ? linkElement.href : null
        };
    });
      return postElements;
    });
    await browser.close();
    return posts2;
  } catch (err) {
    console.error('Error scraping Airbnb posts:', err);
    return [];
  }
}
app.get('/scrape-airbnb', async (req, res) => {
  //const { location, category, checkin, checkout, guests } = req.query;
 // Default search URL for Airbnb
 // Construct the initial Airbnb URL (without map bounds)
  // Get today's date
const today = new Date();
const tomorrow = new Date();
tomorrow.setDate(today.getDate() + 1);
 // Get the first day of the current month
const monthlyStartDate = new Date(today.getFullYear(), today.getMonth(), 1);

// Get the end date three months from the current month
const monthlyEndDate = new Date(today.getFullYear(), today.getMonth() + 3, 0); // 0 gives the last day of the previous month
// Format the dates to YYYY-MM-DD
const monthlyStart = monthlyStartDate.toISOString().split('T')[0];  // First day of current month
const monthlyEnd = monthlyEndDate.toISOString().split('T')[0];  // Last day of the month 3 months from now

 
const { searchUrl, category } = req.query;
// Parse the searchUrl to extract the query parameters
const parsedUrl = new URL(searchUrl);
const location = parsedUrl.pathname.split('/')[2]; // Extract 'location' from the path
const checkin = parsedUrl.searchParams.get('checkin');
const checkout = parsedUrl.searchParams.get('checkout');
const guests = parsedUrl.searchParams.get('adults');
//const monthly_start = parsedUrl.searchParams.get('monthlyStart');
//const monthly_end = parsedUrl.searchParams.get('monthlyEnd');

console.log(`Location: ${location}, Checkin: ${checkin}, Checkout: ${checkout}, Guests: ${guests}`);

// Use these parameters to build your final search URL
let finalSearchUrl = `https://www.airbnb.com/s/${location}/homes?tab_id=home_tab&refinement_paths%5B%5D=%2Fhomes&adults=${guests}&flexible_trip_lengths%5B%5D=one_week&monthly_start_date=${monthlyStart}&monthly_length=3&monthly_end_date=${monthlyEnd}&price_filter_input_type=0&channel=EXPLORE&date_picker_type=calendar&checkin=${checkin}&checkout=${checkout}&source=structured_search_input_header&search_type=unknown&price_filter_num_nights=1&drawer_open=true`;

console.log(`Generated URL: ${finalSearchUrl}`);
//let searchUrl = `https://www.airbnb.com/s/${location}/homes?tab_id=home_tab&refinement_paths%5B%5D=%2Fhomes&adults=2&flexible_trip_lengths%5B%5D=one_week&monthly_start_date=${monthlyStart}&monthly_length=3&monthly_end_date=${monthlyEnd}&price_filter_input_type=0&channel=EXPLORE&date_picker_type=calendar&checkin=${checkin}&checkout=${checkout}&adults=${guests}&source=structured_search_input_header&search_type=unknown&price_filter_num_nights=1&drawer_open=true`;
  console.log(`Scraping Airbnb posts for URL: ${finalSearchUrl}`);  // Log the URL for debugging
  const posts2 = await scrapeAirbnbPosts(finalSearchUrl);  // Pass the dynamic URL to the scraping function
  console.log('Scraped posts: ', posts2);
  //res.json(posts);  // Send the scraped posts back as JSON response
  // Add filters based on category
  switch (category) {
    case 'popular':
      // No additional filter needed for 'popular', just return regular search results
      break;
    case 'cheapest':
      finalSearchUrl += `&price_min=1`; // This is a placeholder for cheapest filter
      break;
      case 'mid-price':
        finalSearchUrl += `&price_min=50&price_max=200`; // Mid-price range (adjust as needed)
      break;
    case 'expensive':
      finalSearchUrl += `&price_max=10000`; // Placeholder for expensive filter (you might need to modify this)
      break;
    // Add other categories as necessary
    default:
      break;
  }

console.log(`Generated URL: ${finalSearchUrl}`);
  // Extract the map bounds and zoom level from the initial Airbnb URL
  /**
   
   
  const { mapBounds, zoomLevel } = await extractBoundsFromUrl(finalSearchUrl);
  
  
  * */
  // Scrape the pixel coordinates of the markers

  /** 
   
  const markers = await scrapeAirbnbMapMarkers(finalSearchUrl);

  **/
  /**  if (!Array.isArray(markers)) {
    console.error("Markers is not an array:", markers);
    return res.status(500).json({ error: "Markers is not an array" });
  }

  if (!mapBounds || isNaN(zoomLevel)) {
    res.status(500).json({ error: 'Failed to fetch map bounds' });
    return;
  }
   // Construct the final Airbnb URL with map bounds and zoom level
   finalSearchUrl += `&ne_lat=${mapBounds.northeast.lat}&ne_lng=${mapBounds.northeast.lng}&sw_lat=${mapBounds.southwest.lat}&sw_lng=${mapBounds.southwest.lng}&zoom=${zoomLevel}&zoom_level=${zoomLevel}&search_by_map=true`;
   console.log('Navigating to final URL:', finalSearchUrl);
console.log('Map bounds:', mapBounds);
  console.log('Zoom Level:', zoomLevel);
  console.log('Marker positions:', markers);
    

  // Convert each pixel marker to lat/lng
  // Convert all marker pixel positions to lat/lng
  const mapWidth = 1024;
  const mapHeight = 768;
// Convert all marker pixel positions to lat/lng with scaling
const scaleFactor = 3; // Adjust this factor as needed
const markerLatLngs = markers.map(marker => pixelToLatLng(marker.left, marker.top, mapBounds, mapWidth, mapHeight, scaleFactor));

console.log('Converted Marker Lat/Lng with Scaling:', markerLatLngs);
console.log('Scraping completed, posts fetched: ', posts2.length);
  // Send the lat/lng markers as JSON response
  //res.json(markerLatLngs);
  **/
  
    if (!Array.isArray(posts2)) {
        throw new Error('Posts should be an array');
    }
  res.json({
    posts2,       // The Airbnb posts
    /** markers: markerLatLngs  **/ // The converted marker coordinates
  })
});
// Airbnb Scraping based on region and category (New functionality)

// Function to scrape pixel positions of Airbnb markers

async function simulateMouseDrag(page, startX, startY, endX, endY) {
  // Move the mouse to the start position
  await page.mouse.move(startX, startY);

  // Simulate mouse down (click and hold)
  await page.mouse.down();

  // Simulate the drag to the end position
  await page.mouse.move(endX, endY, { steps: 10 }); // Adjust 'steps' for smoothness

  // Simulate mouse up (release the click)
  await page.mouse.up();
}

async function clickAcceptCookiesButton(page) {
  try {
      // Retrieve all buttons and their text
      const buttons = await page.$$eval('button', (btns) => btns.map((btn) => btn.textContent.trim()));

      // Find the index of the "Accept all" button
      const acceptCookiesButtonIndex = buttons.findIndex((button) =>
          button.toLowerCase().includes('accept all')
      );

      if (acceptCookiesButtonIndex !== -1) {
          // Construct a selector based on the button's position in the DOM
          const buttonSelector = `button:nth-of-type(${acceptCookiesButtonIndex + 1})`;

          // Wait for the button and click it
          await page.waitForSelector(buttonSelector, { timeout: 30000 });
          const button = await page.$(buttonSelector);

          if (button) {
              await button.click();
              console.log("Clicked 'Accept Cookies' button.");
          } else {
              console.warn("'Accept Cookies' button not found.");
          }
      } else {
          console.warn("'Accept Cookies' button text not found.");
      }
  } catch (error) {
      console.error("Error clicking 'Accept Cookies' button:", error.message);
  }
}

// Function to scrape location information from Airbnb and fetch bounds from Google Maps
async function extractBoundsFromUrl(searchUrl) {
  let browser;
  try {
    browser = await chromium.puppeteer.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Mac path
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      headless: true,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    await navigateToPageWithRetry(page, searchUrl);

    // Close popups
    await page.evaluate(() => {
      const popup = document.querySelector('div.c8qah1m.atm_9s_11p5wf0.atm_h_1h6ojuz');
      const closeButton = popup?.querySelector('button.cd570ix.atm_d2_1bvjyxt.atm_gz_exct8b.atm_j_v2br90');
      if (closeButton) closeButton.click();
    });

    // Accept cookies
    await clickAcceptCookiesButton(page);

    const buttons = await page.$$eval('button', btns => btns.map(b => b.innerText.trim()));
    const showMapButtonIndex = buttons.findIndex(t => t.includes('Show map'));

    if (showMapButtonIndex !== -1) {
      const allButtons = await page.$$('button');
      await allButtons[showMapButtonIndex].click();
      await waitForTimeout(30000);
    }

    await page.waitForSelector('div[data-testid="map/GoogleMap"]', { visible: true });

    // Simulate map drag to force URL update
    await simulateMouseDrag(page, 300, 200, 305, 215);
    await simulateMouseDrag(page, 305, 215, 310, 230);
    await waitForTimeout(5000);

    const newUrl = page.url();
    const parsedUrl = new URL(newUrl);

    const mapBounds = {
      northeast: {
        lat: parseFloat(parsedUrl.searchParams.get("ne_lat")),
        lng: parseFloat(parsedUrl.searchParams.get("ne_lng")),
      },
      southwest: {
        lat: parseFloat(parsedUrl.searchParams.get("sw_lat")),
        lng: parseFloat(parsedUrl.searchParams.get("sw_lng")),
      },
    };

    const zoomLevel = parseFloat(parsedUrl.searchParams.get("zoom"));
    return { mapBounds, zoomLevel };

  } catch (err) {
    console.error("❌ Error during map scraping:", err);
    throw err;
  } finally {
    if (browser) {
      await browser.close().catch(err => console.warn("⚠️ Error closing browser:", err));
    }
  }
}

// Function to scrape pixel positions of Airbnb markers
async function scrapeAirbnbMapMarkers(searchUrl) {
  const browser = await chromium.puppeteer.launch({
    args: [...chromium.args,'--no-sandbox',
    '--disable-gpu',
    '--disable-setuid-sandbox',
    '--single-process',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=9222'],
      //executablePath: await chromium.executablePath || "/usr/bin/chromium-browser",
      headless: true, // or false for debugging
      ignoreHTTPSErrors: true,
    });
  const page = await browser.newPage();

  // Navigate to Airbnb map page
  await navigateToPageWithRetry(page, searchUrl);
  await page.evaluate(() => {
  // Select the popup container
const popup = document.querySelector('div.c8qah1m.atm_9s_11p5wf0.atm_h_1h6ojuz');

// Select the close button within the popup using its class
const closeButton = popup ? popup.querySelector('button.cd570ix.atm_d2_1bvjyxt.atm_gz_exct8b.atm_j_v2br90') : null;

// Click the close button
if (closeButton) {
    closeButton.click();
    console.log('Popup closed successfully.');
} else {
    console.log('Close button not found.');
}
  })
  await page.evaluate(() => {
    // Select the popup container
  const popup2 = document.querySelector('div.tw5hock atm_c8_2x1prs atm_g3_1jbyh58 atm_fr_11a07z3 atm_cs_wp830q dir dir-ltr');
  
  // Select the close button within the popup using its class
  const closeButton = popup2 ? popup2.querySelector('button.b1rrt7c2 atm_mk_h2mmj6 atm_vy_l52nlx atm_e2_l52nlx atm_gi_idpfg4 atm_l8_idpfg4 atm_3f_glywfm atm_5j_1ssbidh atm_26_1j28jx2 atm_9j_tlke0l atm_tl_1gw4zv3 atm_7l_3ha9i4 atm_kd_glywfm atm_92_1yyfdc7_vmtskl atm_9s_1ulexfb_vmtskl atm_mk_stnw88_vmtskl atm_tk_1ssbidh_vmtskl atm_fq_1ssbidh_vmtskl atm_tr_pryxvc_vmtskl atm_vy_1tcgj5g_vmtskl atm_e2_1tcgj5g_vmtskl atm_5j_1ssbidh_vmtskl atm_3f_glywfm_jo46a5 atm_l8_idpfg4_jo46a5 atm_gi_idpfg4_jo46a5 atm_3f_glywfm_1icshfk atm_kd_glywfm_19774hq atm_uc_aaiy6o_1w3cfyq atm_uc_glywfm_1w3cfyq_1rrf6b5 atm_70_13xi5zr_9xuho3 atm_uc_aaiy6o_pfnrn2_1oszvuo atm_uc_glywfm_pfnrn2_1o31aam atm_70_13xi5zr_1buez3b_1oszvuo dir dir-ltr') : null;
  
  // Click the close button
  if (closeButton) {
      closeButton.click();
      console.log('Popup closed successfully.');
  } else {
      console.log('Close button not found.');
  }
    })
  // Targeting the button by its visible text 'Show map'
  await page.waitForSelector('button', { visible: true });

  const buttons = await page.$$eval('button', buttons => 
    buttons.map(button => button.innerText.trim())
  );
  const acceptCookiesButtonIndex = buttons.findIndex(button => button.includes('Accept all'))

  /*if (acceptCookiesButtonIndex !== -1) {
    // Click on the button that contains 'Show map' text
    const buttonsSelector = await page.$$('button');
    console.log('Clicking "Accept Cookies" button');
    await buttonsSelector[acceptCookiesButtonIndex].click();
    await waitForTimeout(5000); // Wait for the map to load after clicking
  } else {
    console.log('Could not find "Accept Cookies" button.');
  }*/
  const showMapButtonIndex = buttons.findIndex(button => button.includes('Show map'));
  
  if (showMapButtonIndex !== -1) {
    // Click on the button that contains 'Show map' text
    const buttonsSelector = await page.$$('button');
    console.log('Clicking "Show map" button');
    await buttonsSelector[showMapButtonIndex].click();
    await waitForTimeout(5000); // Wait for the map to load after clicking
  } else {
    console.log('Could not find "Show map" button.');
  }
// Simulate dragging the map (start and end coordinates)
await simulateMouseDrag(page, 300, 200, 305, 215); // Adjust coordinates based on map size
await simulateMouseDrag(page, 305, 215, 300, 215);
await simulateMouseDrag(page, 300, 215, 310, 215);
await simulateMouseDrag(page, 300, 215, 310, 230);
// Wait for the map to update
await waitForTimeout(5000);

  // Wait for the marker divs to load
    try {
    await waitForTimeout(5000);
    console.log('Looking for markers...');
    await page.waitForSelector('div[style*="position: absolute"]', { timeout: 10000 });
    
    // Extract marker pixel positions from the map
    console.log('Looking for markers...');
    const markers = await page.evaluate(() => {
      const markerElements = document.querySelectorAll('div[style*="position: absolute"]');
      console.log('Found marker elements:', markerElements.length);
      const markersData = [];

      markerElements.forEach(marker => {
        const style = marker.getAttribute('style');
        const transformMatch = style.match(/transform:\s*translate\((-?\d+(\.\d+)?)px,\s*(-?\d+(\.\d+)?)px\)/);

        if (transformMatch) {
          const left = parseFloat(transformMatch[1]);
          const top = parseFloat(transformMatch[3]);
          // Filter out unwanted markers: (left 0, top 0), (left 1, top 1), (left 24, top 24), (left 50, top 50), and (left 64, top 24)
          // Filter out unwanted markers based on custom rules
          if ((left !== 0 && left !== 1 && left !== 24 && left !== 50 && left !== 64) || (top !== 0 && top !== 1 && top !== 24 && top !== 50)) {
            markersData.push({ left, top });
          }
        }
      });

      console.log('Scraped markers data:', markersData); // Log the scraped data
      return markersData;
    });
    console.log('Markers found:', markers);
    await browser.close();
    return markers;
  } catch (error) {
    console.log('Error finding markers:', error);
    await browser.close();
    return [];
  }
}
// Function to convert pixel positions to latitude and longitude
// Function to convert pixel positions to latitude and longitude with scaling
function pixelToLatLng(pixelX, pixelY, mapBounds, mapWidth = 1024, mapHeight = 768, scaleFactor = 3) {
  if (!mapBounds || !mapBounds.northeast || !mapBounds.southwest) {
    console.error('Invalid map bounds for pixel-to-lat/lng conversion');
    return null;
  }

  // Calculate the latitude and longitude range, scaled down by the scaleFactor
  const latRange = (mapBounds.northeast.lat - mapBounds.southwest.lat) / scaleFactor;
  const lngRange = (mapBounds.northeast.lng - mapBounds.southwest.lng) / scaleFactor;
  const latitudeAdjustment = 9.5; // Adjust this value as needed
  // Convert pixelX and pixelY to latitude and longitude
  const lat = mapBounds.southwest.lat + (pixelY / mapHeight) * latRange + latitudeAdjustment;
  //const lng = mapBounds.southwest.lng + (pixelX / mapWidth) * lngRange;
// Adjust longitude by a small value (e.g., 5 degrees to the right)
const longitudeAdjustment = 30.5; // Adjust this value as needed
const lng = mapBounds.southwest.lng + (pixelX / mapWidth) * lngRange + longitudeAdjustment;

  return { lat, lng };
}
// Express route to scrape Airbnb markers and convert them to lat/lng
app.get('/get-markers', async (req, res) => {
  const { region, category, guests } = req.query; // Get region and category from query params
  // Construct the initial Airbnb URL (without map bounds)
  // Get today's date
const today = new Date();
const tomorrow = new Date();
tomorrow.setDate(today.getDate() + 1);

// Get the first day of the current month
const monthlyStartDate = new Date(today.getFullYear(), today.getMonth(), 1);

// Get the end date three months from the current month
const monthlyEndDate = new Date(today.getFullYear(), today.getMonth() + 3, 0); // 0 gives the last day of the previous month

// Format the dates to YYYY-MM-DD
const checkin = today.toISOString().split('T')[0];  // Today's date in YYYY-MM-DD format
const checkout = tomorrow.toISOString().split('T')[0];  // Tomorrow's date in YYYY-MM-DD format
const monthlyStart = monthlyStartDate.toISOString().split('T')[0];  // First day of current month
const monthlyEnd = monthlyEndDate.toISOString().split('T')[0];  // Last day of the month 3 months from now

// Construct the URL with dynamic dates
let searchUrl = `https://www.airbnb.com/s/${region}/homes?tab_id=home_tab&refinement_paths%5B%5D=%2Fhomes&adults=2&flexible_trip_lengths%5B%5D=one_week&monthly_start_date=${monthlyStart}&monthly_length=3&monthly_end_date=${monthlyEnd}&price_filter_input_type=0&channel=EXPLORE&date_picker_type=calendar&checkin=${checkin}&checkout=${checkout}&adults=${guests}&source=structured_search_input_header&search_type=unknown&price_filter_num_nights=1&drawer_open=true`;

console.log(`Generated URL: ${searchUrl}`);

  //let url2 = `https://www.airbnb.com/s/${region}/homes`;
  switch (category) {
  case 'popular':
      // No additional filter needed for 'popular', just return regular search results
      break;
  case 'cheapest':
    searchUrl += `?price_min=1`;  // Adjust this as necessary
    break;
  case 'mid-price':
    searchUrl += `?price_min=50&price_max=200`;  // Adjust price range as necessary
    break;
  case 'expensive':
    searchUrl += `?price_max=10000`;  // Adjust this as necessary
    break;
  // If the category is 'popular' or other categories, no additional filtering needed
  default:
    break;
}
  // Extract the map bounds and zoom level from the initial Airbnb URL
  const { mapBounds, zoomLevel } = await extractBoundsFromUrl(searchUrl);
  // Scrape the pixel coordinates of the markers
  const markers = await scrapeAirbnbMapMarkers(searchUrl);

  if (!mapBounds || isNaN(zoomLevel)) {
    res.status(500).json({ error: 'Failed to fetch map bounds' });
    return;
  }
   // Construct the final Airbnb URL with map bounds and zoom level
   searchUrl += `&ne_lat=${mapBounds.northeast.lat}&ne_lng=${mapBounds.northeast.lng}&sw_lat=${mapBounds.southwest.lat}&sw_lng=${mapBounds.southwest.lng}&zoom=${zoomLevel}&zoom_level=${zoomLevel}&search_by_map=true`;
   console.log('Navigating to final URL:', searchUrl);
console.log('Map bounds:', mapBounds);
  console.log('Zoom Level:', zoomLevel);
  console.log('Marker positions:', markers);
    

  // Convert each pixel marker to lat/lng
  // Convert all marker pixel positions to lat/lng
  const mapWidth = 1024;
  const mapHeight = 768;
// Convert all marker pixel positions to lat/lng with scaling
const scaleFactor = 3; // Adjust this factor as needed
const markerLatLngs = markers.map(marker => pixelToLatLng(marker.left, marker.top, mapBounds, mapWidth, mapHeight, scaleFactor));

console.log('Converted Marker Lat/Lng with Scaling:', markerLatLngs);


  // Send the lat/lng markers as JSON response
  res.json(markerLatLngs);
});
const PORT = process.env.PORT || 3000;
//const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Wrap Express app as Firebase Cloud Function
//exports.api = functions.https.onRequest(app);
//exports.flightSearchAPI = functions.https.onRequest(app);