import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import styles from "./MapComponent.module.css";

const API_CONFIG = {
  orsKey: process.env.REACT_APP_ORS_API_KEY || "",
  orsUrl: (mode) => `https://api.openrouteservice.org/v2/directions/${mode}/geojson`,
  nominatimUrl: "https://nominatim.openstreetmap.org/search",
  reverseGeocodeUrl: "https://nominatim.openstreetmap.org/reverse",
};

const ROUTE_COLORS = ["#007bff", "#28a745", "#dc3545"];
const DEFAULT_CENTER = [51.505, -0.09];
const DEFAULT_ZOOM = 13;

const fetchLocationName = async (latlng, setName) => {
  try {
    const { data } = await axios.get(API_CONFIG.reverseGeocodeUrl, {
      params: { lat: latlng.lat, lon: latlng.lng, format: "json" },
    });
    setName(data.display_name || "Unknown Location");
  } catch (error) {
    console.error("Error fetching location name:", error);
    setName("Unknown Location");
  }
};

const LocationMarker = ({ origin, setOrigin, setDestination, setOriginName, setDestinationName }) => {
  useMapEvents({
    click: async (e) => {
      const { latlng } = e;
      if (!origin) {
        setOrigin(latlng);
        await fetchLocationName(latlng, setOriginName);
      } else {
        setDestination(latlng);
        await fetchLocationName(latlng, setDestinationName);
      }
    },
  });
  return null;
};

const MapCenterControl = ({ location }) => {
  const map = useMap();
  useEffect(() => {
    if (location) map.setView([location.lat, location.lng], DEFAULT_ZOOM);
  }, [location, map]);
  return null;
};

const useRoutePlanner = () => {
  const [state, setState] = useState({
    origin: null,
    destination: null,
    originName: "",
    destinationName: "",
    routes: [],
    selectedRouteIndex: 0,
    distance: "",
    duration: "",
    searchTerm: "",
    searchResults: [],
    mode: "driving-car",
    isLoadingRoute: false,
    routeError: "",
  });

  const updateState = (updates) => setState((prev) => ({ ...prev, ...updates }));

  const fetchRoute = async () => {
    const { origin, destination, mode } = state;
    if (!origin || !destination) return updateState({ routeError: "Please set both origin and destination." });
    if (!API_CONFIG.orsKey) return updateState({ routeError: "API key is missing." });

    updateState({ isLoadingRoute: true, routeError: "", routes: [], distance: "", duration: "" });

    try {
      const { data } = await axios.post(
        API_CONFIG.orsUrl(mode),
        {
          coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
          alternative_routes: { target_count: 3, weight_factor: 1.4, share_factor: 0.6 },
        },
        { headers: { Authorization: API_CONFIG.orsKey, "Content-Type": "application/json" } }
      );

      if (!data.features?.length) throw new Error("No routes found.");
      const routes = data.features.map((feature) => ({
        coordinates: feature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        distance: (feature.properties.summary.distance / 1000).toFixed(2),
        duration: (feature.properties.summary.duration / 60).toFixed(2),
      }));
      updateState({
        routes,
        selectedRouteIndex: 0,
        distance: `${routes[0].distance} km`,
        duration: `${routes[0].duration} min`,
      });
    } catch (error) {
      console.error("Error fetching route:", error);
      updateState({ routeError: `Failed to fetch route: ${error.message}` });
    } finally {
      updateState({ isLoadingRoute: false });
    }
  };

  useEffect(() => {
    if (state.origin && state.destination && !state.isLoadingRoute) fetchRoute();
  }, [state.mode, state.origin, state.destination]);

  return [state, updateState, fetchRoute];
};

const MapComponent = () => {
  const [state, updateState, fetchRoute] = useRoutePlanner();

  const handleSearch = async (e) => {
    const term = e.target.value;
    updateState({ searchTerm: term });
    if (term.length < 3) return updateState({ searchResults: [] });

    try {
      const { data } = await axios.get(API_CONFIG.nominatimUrl, {
        params: { q: term, format: "json" },
      });
      updateState({ searchResults: data });
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
    }
  };

  const selectLocation = async (lat, lon) => {
    const location = { lat, lng: lon };
    if (!state.origin) {
      updateState({ origin: location });
      await fetchLocationName(location, (name) => updateState({ originName: name }));
    } else {
      updateState({ destination: location });
      await fetchLocationName(location, (name) => updateState({ destinationName: name }));
    }
    updateState({ searchResults: [], searchTerm: "" });
  };

  const setCurrentLocation = () => {
    if (!navigator.geolocation) return alert("Geolocation is not supported by your browser.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        updateState({ origin: location });
        fetchLocationName(location, (name) => updateState({ originName: name }));
      },
      (error) => {
        console.error("Error fetching current location:", error);
        alert("Unable to fetch your location. Please try again or select manually.");
      }
    );
  };

  const handleRouteChange = (index) => {
    updateState({
      selectedRouteIndex: index,
      distance: `${state.routes[index].distance} km`,
      duration: `${state.routes[index].duration} min`,
    });
  };

  const resetRoute = () => {
    updateState({
      origin: null,
      destination: null,
      originName: "",
      destinationName: "",
      routes: [],
      selectedRouteIndex: 0,
      distance: "",
      duration: "",
      routeError: "",
      searchTerm: "",
      searchResults: [],
    });
  };

  const renderSearchResults = () =>
    state.searchResults.length > 0 && (
      <ul className={`${styles.searchResults} list-group mt-2 shadow-sm`}>
        {state.searchResults.map((result, index) => (
          <li
            key={index}
            onClick={() => selectLocation(result.lat, result.lon)}
            className="list-group-item list-group-item-action text-muted hover-bg-light"
          >
            {result.display_name}
          </li>
        ))}
      </ul>
    );

  const renderRouteDetails = () =>
    state.routes.length > 0 && (
      <div className="mb-4">
        <label className="form-label fw-semibold text-muted">Route Details</label>
        <div className="row">
          <div className="col-6">
            <p className="text-muted">
              <i className="bi bi-rulers me-2"></i>
              <strong>Distance:</strong> {state.distance}
            </p>
          </div>
          <div className="col-6">
            <p className="text-muted">
              <i className="bi bi-clock me-2"></i>
              <strong>Duration:</strong> {state.duration}
            </p>
          </div>
        </div>
      </div>
    );

  const renderRouteOptions = () =>
    state.routes.length > 0 && (
      <div className="mb-4">
        <label className="form-label fw-semibold text-muted">Choose a Route</label>
        <div className="d-flex flex-wrap gap-2">
          {state.routes.map((route, index) => (
            <button
              key={index}
              onClick={() => handleRouteChange(index)}
              className={`btn btn-sm ${
                state.selectedRouteIndex === index ? "btn-primary" : "btn-outline-secondary"
              }`}
              style={{ border: `2px solid ${ROUTE_COLORS[index]}` }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  backgroundColor: ROUTE_COLORS[index],
                  borderRadius: "50%",
                  marginRight: "6px",
                }}
              ></span>
              Route {index + 1} ({route.distance} km)
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="container-fluid p-4 min-vh-100 bg-light">
      <div className="row justify-content-center">
        <div className="col-md-10 col-lg-8">
          <h2 className="text-center mb-4 fw-bold text-primary">Route Planner</h2>
          <div className="card shadow-sm mb-4">
            <div className="card-body p-4">
              <div className="mb-4">
                <label className="form-label fw-semibold text-muted">Search Location</label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    placeholder="Enter origin or destination..."
                    value={state.searchTerm}
                    onChange={handleSearch}
                    className="form-control"
                  />
                </div>
                {renderSearchResults()}
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold text-muted">Your Route</label>
                <div className="d-flex align-items-center mb-2">
                  <p className="mb-0 text-muted flex-grow-1">
                    <i className="bi bi-geo-alt-fill text-primary me-2"></i>
                    <strong>From:</strong> {state.originName || "Search or click map"}
                  </p>
                  <button
                    onClick={setCurrentLocation}
                    className="btn btn-primary btn-sm ms-2"
                    title="Use My Location"
                  >
                    <i className="bi bi-geo-fill"></i>
                  </button>
                </div>
                <p className="mb-0 text-muted">
                  <i className="bi bi-geo-alt-fill text-danger me-2"></i>
                  <strong>To:</strong> {state.destinationName || "Search or click map"}
                </p>
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold text-muted">Travel Mode</label>
                <select
                  onChange={(e) => updateState({ mode: e.target.value })}
                  value={state.mode}
                  className="form-select"
                >
                  <option value="driving-car">🚗 Driving</option>
                  <option value="cycling-regular">🚲 Cycling</option>
                  <option value="foot-walking">🚶 Walking</option>
                </select>
              </div>

              {state.isLoadingRoute && (
                <div className="alert alert-info d-flex align-items-center mb-4">
                  <i className="bi bi-hourglass-split me-2"></i>Loading route...
                </div>
              )}
              {state.routeError && (
                <div className="alert alert-danger d-flex align-items-center mb-4">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>{state.routeError}
                </div>
              )}

              {renderRouteDetails()}
              {renderRouteOptions()}

              <div className="d-flex gap-2">
                <button
                  onClick={fetchRoute}
                  disabled={!state.origin || !state.destination || state.isLoadingRoute}
                  className="btn btn-primary btn-lg flex-fill"
                >
                  <i className="bi bi-map me-2"></i>
                  {state.isLoadingRoute ? "Fetching..." : "Get Route"}
                </button>
                <button onClick={resetRoute} className="btn btn-outline-secondary btn-sm flex-fill">
                  <i className="bi bi-arrow-counterclockwise me-2"></i>Reset
                </button>
              </div>
            </div>
          </div>

          <div className="card shadow-sm">
            <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: "60vh" }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapCenterControl location={state.origin || state.destination} />
              <LocationMarker
                origin={state.origin}
                setOrigin={(val) => updateState({ origin: val })}
                setDestination={(val) => updateState({ destination: val })}
                setOriginName={(val) => updateState({ originName: val })}
                setDestinationName={(val) => updateState({ destinationName: val })}
              />
              {state.origin && <Marker position={state.origin} />}
              {state.destination && <Marker position={state.destination} />}
              {state.routes.map((route, index) => (
                <Polyline
                  key={index}
                  positions={route.coordinates}
                  color={ROUTE_COLORS[index]}
                  weight={state.selectedRouteIndex === index ? 5 : 3}
                  opacity={state.selectedRouteIndex === index ? 1 : 0.5}
                />
              ))}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;