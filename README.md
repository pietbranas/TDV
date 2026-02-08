# 💎 Jeweller Pricing Platform

A comprehensive pricing and quote management platform for jewellers. Automates pricing calculations based on live metal prices, manages materials from suppliers, and generates professional PDF quotes.

## Features

- **Live Metal Prices**: Automatic fetching of gold, silver, platinum, palladium, and rhodium prices
- **Currency Conversion**: Real-time USD to ZAR conversion with multiple currency support
- **Quote Management**: Create, edit, duplicate, and track quotes with version history
- **PDF Export**: Generate professional PDF quotes with customizable templates
- **Material Management**: Import supplier price lists (CSV/Excel), track inventory
- **Customer Database**: Manage customers with import/export capabilities
- **Item Catalog**: Organize jewellery items by category with SKU tracking
- **Pricing Calculator**: Automatic calculation of metal costs, labour, and markups

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, React Query
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **PDF Generation**: PDFKit
- **Authentication**: JWT with bcrypt

## Project Structure

```
├── backend/
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   ├── src/
│   │   ├── middleware/        # Auth middleware
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   └── index.ts           # Server entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── lib/               # API client
│   │   └── store/             # State management
│   └── package.json
└── package.json               # Root workspace
```

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or pnpm

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/pietbranas/sloth2sloth.git
cd sloth2sloth
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your settings:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/jeweller_db?schema=public"

# JWT Secret (generate a secure random string)
JWT_SECRET="your-super-secret-jwt-key-change-this"

# Server
PORT=3001
NODE_ENV=development

# Optional: API Keys for better rate limits
GOLD_API_KEY=""
EXCHANGE_RATE_API_KEY=""
```

### 4. Set Up Database

```bash
# Create the database
createdb jeweller_db

# Run migrations
cd backend
npx prisma migrate dev --name init

# Seed with sample data
npx prisma db seed
```

### 5. Start Development Servers

```bash
# From root directory - starts both frontend and backend
npm run dev
```

Or run separately:

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### 6. Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api

**Default Login:**
- Email: `admin@jeweller.local`
- Password: `admin123`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/auth/me` - Get current user

### Quotes
- `GET /api/quotes` - List quotes
- `POST /api/quotes` - Create quote
- `GET /api/quotes/:id` - Get quote
- `PUT /api/quotes/:id` - Update quote
- `DELETE /api/quotes/:id` - Delete quote
- `GET /api/quotes/:id/pdf` - Download PDF

### Customers
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `POST /api/customers/import` - Import from CSV

### Materials
- `GET /api/materials` - List materials
- `POST /api/materials/import` - Import price list

### Prices
- `GET /api/prices/metals` - Get metal prices
- `GET /api/prices/exchange` - Get exchange rates
- `POST /api/prices/refresh` - Refresh prices

---

## Deployment to AWS Lightsail

### Option 1: Container Deployment (Recommended)

#### 1. Create Dockerfile

Create `Dockerfile` in the root directory:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Build backend
RUN cd backend && npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy backend
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/backend/prisma ./backend/prisma

# Copy frontend build
COPY --from=builder /app/frontend/dist ./frontend/dist

# Install production dependencies
RUN cd backend && npm install --production

# Generate Prisma client
RUN cd backend && npx prisma generate

EXPOSE 3001

WORKDIR /app/backend

CMD ["node", "dist/index.js"]
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/jeweller_db
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=jeweller_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

#### 3. Deploy to Lightsail

1. **Create Lightsail Instance**
   - Go to AWS Lightsail Console
   - Click "Create instance"
   - Choose "Linux/Unix" → "OS Only" → "Ubuntu 22.04 LTS"
   - Select instance plan (minimum 1GB RAM recommended)
   - Name your instance and create

2. **Connect to Instance**
   ```bash
   ssh -i your-key.pem ubuntu@your-instance-ip
   ```

3. **Install Docker**
   ```bash
   sudo apt update
   sudo apt install -y docker.io docker-compose
   sudo usermod -aG docker ubuntu
   # Log out and back in
   ```

4. **Clone and Deploy**
   ```bash
   git clone https://github.com/pietbranas/sloth2sloth.git
   cd sloth2sloth
   
   # Create .env file
   echo "JWT_SECRET=$(openssl rand -base64 32)" > .env
   
   # Build and start
   docker-compose up -d --build
   
   # Run migrations
   docker-compose exec app npx prisma migrate deploy
   docker-compose exec app npx prisma db seed
   ```

5. **Configure Networking**
   - In Lightsail console, go to "Networking"
   - Add rule: Custom TCP, Port 3001
   - (Optional) Set up a static IP

6. **Set Up Domain (Optional)**
   - Create a Lightsail DNS zone
   - Point your domain to the static IP
   - Set up SSL with Let's Encrypt

### Option 2: Direct Deployment (Without Docker)

#### 1. Create Lightsail Instance
- Same as above, but choose a larger instance (2GB+ RAM)

#### 2. Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install PM2 for process management
sudo npm install -g pm2
```

#### 3. Configure PostgreSQL
```bash
sudo -u postgres psql

CREATE USER jeweller WITH PASSWORD 'your-secure-password';
CREATE DATABASE jeweller_db OWNER jeweller;
GRANT ALL PRIVILEGES ON DATABASE jeweller_db TO jeweller;
\q
```

#### 4. Deploy Application
```bash
# Clone repository
git clone https://github.com/pietbranas/sloth2sloth.git
cd sloth2sloth

# Install dependencies
npm install

# Configure environment
cp backend/.env.example backend/.env
nano backend/.env
# Update DATABASE_URL and JWT_SECRET

# Build
cd frontend && npm run build && cd ..
cd backend && npm run build && cd ..

# Run migrations
cd backend
npx prisma migrate deploy
npx prisma db seed
cd ..

# Start with PM2
pm2 start backend/dist/index.js --name jeweller-api
pm2 save
pm2 startup
```

#### 5. Set Up Nginx (Optional but Recommended)
```bash
sudo apt install -y nginx

sudo nano /etc/nginx/sites-available/jeweller
```

Add configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /home/ubuntu/sloth2sloth/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/jeweller /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## GitHub Setup

### Push to Remote Repository

```bash
# Initialize git (if not already)
git init

# Add remote
git remote add origin https://github.com/pietbranas/sloth2sloth.git

# Add all files
git add .

# Commit
git commit -m "Initial commit: Jeweller Pricing Platform"

# Push
git push -u origin main
```

### GitHub Actions CI/CD (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Lightsail

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Lightsail
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.LIGHTSAIL_HOST }}
          username: ubuntu
          key: ${{ secrets.LIGHTSAIL_SSH_KEY }}
          script: |
            cd ~/sloth2sloth
            git pull origin main
            docker-compose up -d --build
            docker-compose exec -T app npx prisma migrate deploy
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `PORT` | Server port (default: 3001) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `GOLD_API_KEY` | GoldAPI.io API key for metal prices | No |
| `EXCHANGE_RATE_API_KEY` | Exchange rate API key | No |

---

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -h localhost -U jeweller -d jeweller_db
```

### Port Already in Use
```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Prisma Issues
```bash
# Regenerate client
npx prisma generate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

---

## License

MIT License - See LICENSE file for details.

## Support

For issues and feature requests, please use the GitHub Issues page.