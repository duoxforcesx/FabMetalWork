# FABWORKS Website - Setup Guide (Hindi)

## Is project mein kya hai?
- Black + Orange business website
- Home, About, Services, Gallery, Reviews, Contact
- Enquiry form: enquiry database mein save hoti hai
- Customer review: pehle Pending hota hai; Admin approve kare tabhi public hota hai
- Admin login + dashboard
- Admin se enquiries, reviews, services, gallery photos aur business details manage kar sakte hain
- Optional WhatsApp Cloud API notification integration

## 1. Zaroori software
- Node.js LTS install karein: https://nodejs.org/
- VS Code (already installed ho sakta hai)

## 2. Project folder kholein
ZIP extract karke `fabworks-website` folder VS Code mein open karein.

## 3. Environment file banayein
- `.env.example` ki copy banayein.
- Copy ka naam `.env` rakhein.
- `.env` mein `ADMIN_PASSWORD` ko apne strong private password se badlein.
- `SESSION_SECRET` ko bhi ek lambi random secret string se badlein.
- `.env` ko kisi ko share na karein.

## 4. Terminal kholein
VS Code menu: Terminal > New Terminal

Commands ek-ek karke chalayein:

```bash
npm install
npm start
```

Terminal mein `FABWORKS website running at http://localhost:3000` dikhe to browser mein kholein:
http://localhost:3000

Admin:
http://localhost:3000/admin.html

Login:
- Username: `.env` mein jo ADMIN_USERNAME hai (default `admin`)
- Password: `.env` mein jo ADMIN_PASSWORD set kiya hai

## 5. Business details kaise set karein
Admin login > Website Details:
- Business name
- Tagline
- Phone
- WhatsApp number
- Email
- Address
- Years in business / experience
- About text

## 6. Services aur Gallery
Admin > Services: add/edit/delete.
Admin > Gallery: JPG, PNG ya WEBP photo upload/delete (max 5 MB).

## 7. Reviews kaise kaam karte hain
Customer review submit karega to woh Pending rahega. Admin > Reviews se Approve karne par hi public website par dikhega.

## 8. WhatsApp automatic notification
WhatsApp notification abhi optional integration hai. Iske liye Meta WhatsApp Cloud API ka approved setup, access token, Phone Number ID aur owner number chahiye.
`.env` mein:
- WHATSAPP_TOKEN
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_OWNER_NUMBER
- WHATSAPP_API_VERSION

Token server ki `.env` file mein hi rakhein. Public HTML/JS mein kabhi na daalein. Meta ke message/template, opt-in aur business rules follow karein. API/provider charges ho sakte hain. API set na ho to enquiry phir bhi website database mein save hogi, lekin WhatsApp notification nahi jayegi.

## Important security / launch notes
- Yeh local starter project hai. Public launch se pehle HTTPS hosting, persistent session store, backups, secure secrets, database backup, privacy notice, spam protection aur production testing zaroor karein.
- SQLite database `data/fabworks.sqlite` mein banta hai. Is file ka backup rakhein.
- `.env` aur database ko public web folder mein upload na karein.
- Admin password kisi ke saath share na karein.
- Free hosting ke plans/sleep limits badal sakte hain. Deployment se pehle provider ki current terms check karein.
