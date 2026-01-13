
# SafeRoute AI Backend

This is the backend service for the SafeRoute AI application. It provides API endpoints for routing and place search, leveraging Google Maps APIs and adding safety intelligence layers.

## Setup

1.  Navigate to the `backend` directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file in the `backend` directory with the following content:
    ```
    PORT=5000
    GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
    ```
    *Note: You need to enable Directions API and Places API (New) in your Google Cloud Console for this key.*

## Running the Server

To start the server:

```bash
npm start
```

For development with auto-restart (Node 18+):

```bash
npm run dev
```

## API Endpoints

### 1. Get Routes
- **Endpoint**: `POST /api/maps/routes`
- **Body**:
  ```json
  {
    "origin": "Origin Address or Lat,Lng",
    "destination": "Destination Address or Lat,Lng",
    "mode": "walking"
  }
  ```
- **Response**: Returns a list of routes with added `safetyScore`.

### 2. Place Autocomplete
- **Endpoint**: `GET /api/maps/places/autocomplete`
- **Query Params**: `input` (string)

### 3. Place Details
- **Endpoint**: `GET /api/maps/places/details`
- **Query Params**: `placeId` (string)
