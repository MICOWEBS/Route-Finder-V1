import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

const ORS_API_KEY = process.env.REACT_APP_ORS_API_KEY || "";
const NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";
const REVERSE_GEOCODE_URL = "https://nominatim.openstreetmap.org/reverse";

const LocationMarker = ({ origin, setOrigin, setDestination, setOriginName, setDestinationName }) => {
  useMapEvents({
    click: async (e) => {
      if (!origin) {
        setOrigin(e.latlng);
        fetchLocationName(e.latlng, setOriginName);
      } else {
        setDestination(e.latlng);
        fetchLocationName(e.latlng, setDestinationName);
      }
    },
  });
  return null;
};

const fetchLocationName = async (latlng, setLocationName) => {
  try {
    const response = await axios.get(REVERSE_GEOCODE_URL, {
      params: { lat: latlng.lat, lon: latlng.lng, format: "json" },
    });
    setLocationName(response.data.display_name || "Unknown Location");
  } catch (error) {
    console.error("Error fetching location name:", error);
    setLocationName("Unknown Location");
  }
};

const MapCenterControl = ({ location }) => {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.setView([location.lat, location.lng], 13);
    }
  }, [location, map]);
  return null;
};

const MapComponent = () => {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [originName, setOriginName] = useState("");
  const [destinationName, setDestinationName] = useState("");
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [mode, setMode] = useState("driving-car");
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState("");

  const routeColors = ["#007bff", "#28a745", "#dc3545"];

  const fetchRoute = async () => {
    if (!origin || !destination) {
      setRouteError("Please set both origin and destination.");
      return;
    }
    if (!ORS_API_KEY) {
      setRouteError("API key is missing. Please configure the OpenRouteService API key.");
      return;
    }
    setIsLoadingRoute(true);
    setRouteError("");
    setRoutes([]);
    setDistance("");
    setDuration("");

    const url = `https://api.openrouteservice.org/v2/directions/${mode}/geojson`;
    const body = {
      coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
      alternative_routes: { target_count: 3, weight_factor: 1.4, share_factor: 0.6 },
    };

    try {
      const response = await axios.post(url, body, {
        headers: { Authorization: ORS_API_KEY, "Content-Type": "application/json" },
      });
      if (!response.data.features || response.data.features.length === 0) {
        throw new Error("No routes found in the API response.");
      }
      const fetchedRoutes = response.data.features.map((feature) => ({
        coordinates: feature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        distance: (feature.properties.summary.distance / 1000).toFixed(2),
        duration: (feature.properties.summary.duration / 60).toFixed(2),
      }));
      setRoutes(fetchedRoutes);
      setSelectedRouteIndex(0);
      setDistance(fetchedRoutes[0].distance + " km");
      setDuration(fetchedRoutes[0].duration + " min");
    } catch (error) {
      console.error("Error fetching route:", error);
      setRouteError(`Failed to fetch route: ${error.message}`);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  useEffect(() => {
    if (origin && destination && !isLoadingRoute) {
      fetchRoute();
    }
  }, [mode, origin, destination]);

  const handleSearch = async (e) => {
    setSearchTerm(e.target.value);
    if (e.target.value.length < 3) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await axios.get(NOMINATIM_API_URL, {
        params: { q: e.target.value, format: "json" },
      });
      setSearchResults(response.data);
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
    }
  };

  const selectLocation = async (lat, lon) => {
    if (!origin) {
      setOrigin({ lat, lng: lon });
      await fetchLocationName({ lat, lng: lon }, setOriginName);
    } else {
      setDestination({ lat, lng: lon });
      await fetchLocationName({ lat, lng: lon }, setDestinationName);
    }
    setSearchResults([]);
    setSearchTerm("");
  };

  const setCurrentLocationAsOrigin = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = { lat: position.coords.latitude, lng: position.coords.longitude };
          setOrigin(location);
          fetchLocationName(location, setOriginName);
        },
        (error) => {
          console.error("Error fetching current location:", error);
          alert("Unable to fetch your location. Please try again or select manually.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleRouteChange = (index) => {
    setSelectedRouteIndex(index);
    setDistance(routes[index].distance + " km");
    setDuration(routes[index].duration + " min");
  };

  const resetRoute = () => {
    setOrigin(null);
    setDestination(null);
    setOriginName("");
    setDestinationName("");
    setRoutes([]);
    setSelectedRouteIndex(0);
    setDistance("");
    setDuration("");
    setRouteError("");
    setSearchTerm("");
    setSearchResults([]);
  };

  return (
    <div className="container-fluid p-4 min-vh-100" style={{ backgroundColor: "#f8f9fa" }}>
      <div className="row justify-content-center">
        <div className="col-md-10 col-lg-8">
          <h2 className="text-center mb-4 fw-bold text-primary" style={{ fontSize: "2rem" }}>
            Route Planner
          </h2>

          <div className="card shadow-sm mb-4" style={{ borderRadius: "15px" }}>
            <div className="card-body p-4">
              <div className="mb-4">
                <label className="form-label fw-semibold text-muted">Search Location</label>
                <div className="input-group">
                  <span className="input-group-text" style={{ borderRadius: "10px 0 0 10px" }}>
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    placeholder="Enter origin or destination..."
                    value={searchTerm}
                    onChange={handleSearch}
                    className="form-control"
                    style={{ borderRadius: "0 10px 10px 0" }}
                  />
                </div>
                {searchResults.length > 0 && (
                  <ul
                    className="list-group mt-2 shadow-sm"
                    style={{ maxHeight: "200px", overflowY: "auto", borderRadius: "10px" }}
                  >
                    {searchResults.map((result, index) => (
                      <li
                        key={index}
                        onClick={() => selectLocation(result.lat, result.lon)}
                        className="list-group-item list-group-item-action text-muted hover-bg-light"
                        style={{ cursor: "pointer" }}
                      >
                        {result.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold text-muted">Your Route</label>
                <div className="d-flex align-items-center mb-2">
                  <p className="mb-0 text-muted flex-grow-1">
                    <i className="bi bi-geo-alt-fill text-primary me-2"></i>
                    <strong>From:</strong> {originName || "Search or click map"}
                  </p>
                  <button
                    onClick={setCurrentLocationAsOrigin}
                    className="btn btn-primary btn-sm ms-2"
                    title="Use My Location"
                    style={{ borderRadius: "50%", width: "36px", height: "36px", padding: "0" }}
                  >
                    <i className="bi bi-geo-fill"></i>
                  </button>
                </div>
                <p className="mb-0 text-muted">
                  <i className="bi bi-geo-alt-fill text-danger me-2"></i>
                  <strong>To:</strong> {destinationName || "Search or click map"}
                </p>
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold text-muted">Travel Mode</label>
                <select
                  onChange={(e) => setMode(e.target.value)}
                  value={mode}
                  className="form-select"
                  style={{ borderRadius: "10px" }}
                >
                  <option value="driving-car">🚗 Driving</option>
                  <option value="cycling-regular">🚲 Cycling</option>
                  <option value="foot-walking">🚶 Walking</option>
                </select>
              </div>

              {routes.length > 0 && (
                <div className="mb-4">
                  <label className="form-label fw-semibold text-muted">Route Details</label>
                  <div className="row">
                    <div className="col-6">
                      <p className="text-muted">
                        <i className="bi bi-rulers me-2"></i>
                        <strong>Distance:</strong> {distance}
                      </p>
                    </div>
                    <div className="col-6">
                      <p className="text-muted">
                        <i className="bi bi-clock me-2"></i>
                        <strong>Duration:</strong> {duration}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isLoadingRoute && (
                <div className="alert alert-info d-flex align-items-center mb-4" role="alert">
                  <i className="bi bi-hourglass-split me-2"></i>Loading route...
                </div>
              )}
              {routeError && (
                <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>{routeError}
                </div>
              )}

              {routes.length > 0 && (
                <div className="mb-4">
                  <label className="form-label fw-semibold text-muted">Choose a Route</label>
                  <div className="d-flex flex-wrap gap-2">
                    {routes.map((route, index) => (
                      <button
                        key={index}
                        onClick={() => handleRouteChange(index)}
                        className={`btn btn-sm ${
                          selectedRouteIndex === index ? "btn-primary" : "btn-outline-secondary"
                        }`}
                        style={{
                          borderRadius: "8px",
                          minWidth: "120px",
                          border: `2px solid ${routeColors[index]}`,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            width: "12px",
                            height: "12px",
                            backgroundColor: routeColors[index],
                            borderRadius: "50%",
                            marginRight: "6px",
                          }}
                        ></span>
                        Route {index + 1} ({route.distance} km)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="d-flex gap-2">
                <button
                  onClick={fetchRoute}
                  disabled={!origin || !destination || isLoadingRoute}
                  className="btn btn-primary btn-lg flex-fill"
                  style={{ borderRadius: "10px" }}
                >
                  <i className="bi bi-map me-2"></i>
                  {isLoadingRoute ? "Fetching..." : "Get Route"}
                </button>
                <button
                  onClick={resetRoute}
                  className="btn btn-outline-secondary btn-sm flex-fill"
                  style={{ borderRadius: "10px" }}
                >
                  <i className="bi bi-arrow-counterclockwise me-2"></i>Reset
                </button>
              </div>
            </div>
          </div>

          <div className="card shadow-sm" style={{ borderRadius: "15px", overflow: "hidden" }}>
            <MapContainer
              center={[51.505, -0.09]}
              zoom={13}
              style={{ height: "60vh", width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapCenterControl location={origin || destination} />
              <LocationMarker
                origin={origin}
                setOrigin={setOrigin}
                setDestination={setDestination}
                setOriginName={setOriginName}
                setDestinationName={setDestinationName}
              />
              {origin && <Marker position={origin} />}
              {destination && <Marker position={destination} />}
              {routes.map((route, index) => (
                <Polyline
                  key={index}
                  positions={route.coordinates}
                  color={routeColors[index]}
                  weight={selectedRouteIndex === index ? 5 : 3}
                  opacity={selectedRouteIndex === index ? 1 : 0.5}
                />
              ))}
            </MapContainer>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hover-bg-light:hover {
          background-color: #f1f3f5;
        }
        .list-group-item-action {
          transition: background-color 0.2s ease;
        }
        .btn-sm:hover {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
};

export default MapComponent;