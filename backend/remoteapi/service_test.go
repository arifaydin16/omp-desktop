package remoteapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthentication(t *testing.T) {
	svc := &Service{
		config: RemoteApiConfig{
			ApiKey: "test-secret-key-12345",
		},
	}

	// 1. Without Auth
	req := httptest.NewRequest("GET", "/api/status", nil)
	if svc.authenticate(req) {
		t.Fatalf("expected unauthenticated request to fail")
	}

	// 2. With Wrong Key
	req = httptest.NewRequest("GET", "/api/status", nil)
	req.Header.Set("Authorization", "Bearer wrong-key")
	if svc.authenticate(req) {
		t.Fatalf("expected wrong key to fail")
	}

	// 3. With Valid Bearer Token
	req = httptest.NewRequest("GET", "/api/status", nil)
	req.Header.Set("Authorization", "Bearer test-secret-key-12345")
	if !svc.authenticate(req) {
		t.Fatalf("expected valid bearer token to pass")
	}

	// 4. With Valid X-API-Key Header
	req = httptest.NewRequest("GET", "/api/status", nil)
	req.Header.Set("X-API-Key", "test-secret-key-12345")
	if !svc.authenticate(req) {
		t.Fatalf("expected valid X-API-Key to pass")
	}

	// 5. With Query Param
	req = httptest.NewRequest("GET", "/api/status?api_key=test-secret-key-12345", nil)
	if !svc.authenticate(req) {
		t.Fatalf("expected valid query param to pass")
	}
}

func TestHttpHandlers(t *testing.T) {
	svc := &Service{
		config: RemoteApiConfig{
			Enabled: true,
			Port:    37420,
			Host:    "127.0.0.1",
			ApiKey:  "sec-key-abc",
		},
	}

	// 1. /api/info (public)
	req := httptest.NewRequest("GET", "/api/info", nil)
	rr := httptest.NewRecorder()
	svc.handleInfo(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from /api/info, got %d", rr.Code)
	}

	// 2. /api/status without auth -> 401
	req = httptest.NewRequest("GET", "/api/status", nil)
	rr = httptest.NewRecorder()
	svc.handleStatus(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized from /api/status, got %d", rr.Code)
	}

	// 3. /api/status with auth -> 200
	req = httptest.NewRequest("GET", "/api/status", nil)
	req.Header.Set("Authorization", "Bearer sec-key-abc")
	rr = httptest.NewRecorder()
	svc.handleStatus(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from /api/status, got %d", rr.Code)
	}

	var statusResp RemoteApiStatus
	_ = json.NewDecoder(rr.Body).Decode(&statusResp)
	if statusResp.Endpoints.PromptEndpoint == "" {
		t.Fatalf("expected PromptEndpoint in response, got empty")
	}

	// 4. /api/prompt with empty prompt -> 400
	body, _ := json.Marshal(map[string]string{"prompt": ""})
	req = httptest.NewRequest("POST", "/api/prompt", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer sec-key-abc")
	rr = httptest.NewRecorder()
	svc.handlePrompt(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for empty prompt, got %d", rr.Code)
	}
}
