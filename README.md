# 🎴 StreamCards Platform

A platform where Twitch viewers can connect with their Twitch ID, claim Twitch Channel Points (COINS), and collect personalized booster cards from streamers. Streamers can manage their own card collections, and viewers can build collections from all streamers on the platform.

## 🚀 Features

- **Twitch Integration**: Connect with Twitch ID and claim Channel Points
- **Coin System**: Earn coins through Twitch rewards
- **Streamer Card Management**: Streamers can create and manage their own card collections
- **Booster Packs**: Purchase booster packs with different rarities and animations
- **Collection System**: Build a collection of cards from all streamers
- **Shop System**: Spend coins on various booster packs

## 🛠️ Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL

## 📁 Project Structure

```
StreamCards/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── config/
│   │   └── App.jsx
│   └── package.json
├── backend/           # Node.js + Express backend
│   ├── config/        # Database configuration
│   ├── routes/        # API routes
│   ├── database/      # Database schema and migrations
│   └── server.js
└── README.md
```

## 🚦 Getting Started

### Prerequisites

- Node.js (v20.19.0 or higher recommended)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd StreamCards
   ```

2. **Set up the backend**
   ```bash
   cd backend
   npm install
   ```

3. **Set up the frontend**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Configure the database**
   - Create a PostgreSQL database named `streamcards`
   - Copy `backend/env.example` to `backend/.env`
   - Update the database credentials in `backend/.env`

5. **Initialize the database**
   ```bash
   cd backend
   node database/init.js
   ```

6. **Set up Twitch OAuth** (optional for now)
   - Get your Twitch Client ID and Secret from [Twitch Developer Console](https://dev.twitch.tv/console)
   - Add them to `backend/.env`

### Running the Application

**Backend** (Terminal 1):
```bash
cd backend
npm run dev
```
Server will run on `http://localhost:5000`

**Frontend** (Terminal 2):
```bash
cd frontend
npm run dev
```
Frontend will run on `http://localhost:5173`

## 📊 Database Schema

The database includes the following main tables:
- `users` - Viewer/collector accounts
- `streamers` - Streamer accounts
- `card_templates` - Card designs managed by streamers
- `user_cards` - User card collections
- `booster_packs` - Shop items
- `transactions` - Coin transactions
- `booster_openings` - Track opened boosters

## 🔐 Environment Variables

Create a `.env` file in the `backend` directory:

```env
PORT=5000
NODE_ENV=development

DB_USER=postgres
DB_HOST=localhost
DB_NAME=streamcards
DB_PASSWORD=your_password
DB_PORT=5432

TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_REDIRECT_URI=http://localhost:5000/api/auth/twitch/callback

JWT_SECRET=your_jwt_secret
```

## 🎯 API Endpoints

### Health & Testing
- `GET /api/health` - API health check
- `GET /api/test-db` - Test database connection

### Authentication
- `GET /api/auth/twitch` - Initiate Twitch OAuth
- `GET /api/auth/twitch/callback` - Twitch OAuth callback

### Cards
- `GET /api/cards/streamer/:streamerId` - Get streamer's cards
- `GET /api/cards/collection/:userId` - Get user's collection
- `POST /api/cards/template` - Create card template (streamer)

### Shop
- `GET /api/shop/boosters` - Get all booster packs
- `POST /api/shop/boosters/:boosterId/purchase` - Purchase booster
- `POST /api/shop/boosters/:boosterId/open` - Open booster pack

## 🚧 Roadmap

- [ ] Implement Twitch OAuth flow
- [ ] Twitch Channel Points integration
- [ ] Card upload and management system
- [ ] Booster pack opening animations
- [ ] User collection display
- [ ] Rarity system implementation
- [ ] Shop functionality
- [ ] Admin dashboard for streamers

## 📝 License

ISC

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

