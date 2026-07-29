import { useEffect, useState, useCallback } from "react";

const CUSTOM_ROUTES_KEY = "my_custom_travel_routes_v1";

export function getStoredCustomRoutes() {
  try {
    const raw = localStorage.getItem(CUSTOM_ROUTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomRouteToStorage(newRoute) {
  const existing = getStoredCustomRoutes();
  const filtered = existing.filter((r) => r.id !== newRoute.id);
  const updated = [newRoute, ...filtered];
  localStorage.setItem(CUSTOM_ROUTES_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("custom_routes_updated"));
  return updated;
}

export function deleteCustomRouteFromStorage(routeId) {
  const existing = getStoredCustomRoutes();
  const updated = existing.filter((r) => r.id !== routeId);
  localStorage.setItem(CUSTOM_ROUTES_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("custom_routes_updated"));
  return updated;
}

export function useTravelData() {
  const [state, setState] = useState({ data: null, topology: null, error: null });

  const loadData = useCallback(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([
      fetch("/data/travel-routes.json", options).then(checkResponse),
      fetch("/data/europe.topo.json", options).then(checkResponse),
    ])
      .then(([data, topology]) => {
        if (!data.routes?.length) throw new Error("여행 루트 데이터가 비어 있습니다");
        const customRoutes = getStoredCustomRoutes();
        const mergedRoutes = [...customRoutes, ...data.routes];
        setState({ data: { routes: mergedRoutes }, topology, error: null });
      })
      .catch((error) => {
        if (error.name !== "AbortError") setState({ data: null, topology: null, error });
      });
    return controller;
  }, []);

  useEffect(() => {
    const controller = loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("custom_routes_updated", handleUpdate);
    return () => {
      controller.abort();
      window.removeEventListener("custom_routes_updated", handleUpdate);
    };
  }, [loadData]);

  return state;
}

async function checkResponse(response) {
  if (!response.ok) throw new Error(`데이터 로딩 실패 (${response.status})`);
  return response.json();
}
