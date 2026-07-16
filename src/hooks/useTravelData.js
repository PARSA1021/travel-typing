import { useEffect, useState } from "react";

export function useTravelData() {
  const [state, setState] = useState({ data: null, topology: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([
      fetch("/data/travel-routes.json", options).then(checkResponse),
      fetch("/data/europe.topo.json", options).then(checkResponse),
    ])
      .then(([data, topology]) => {
        if (!data.routes?.length) throw new Error("여행 루트 데이터가 비어 있습니다");
        setState({ data, topology, error: null });
      })
      .catch((error) => {
        if (error.name !== "AbortError") setState({ data: null, topology: null, error });
      });
    return () => controller.abort();
  }, []);

  return state;
}

async function checkResponse(response) {
  if (!response.ok) throw new Error(`데이터 로딩 실패 (${response.status})`);
  return response.json();
}
