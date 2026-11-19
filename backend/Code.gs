function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  const requestId = Utilities.getUuid();

  console.info(JSON.stringify({
    severity: "INFO",
    requestId,
    functionName: "doGet",
    outcome: "success",
    message: "Backend health check"
  }));

  return jsonResponse({
    ok: true,
    data: {
      service: "quizkada-api",
      environment: "dev",
      status: "healthy"
    },
    requestId
  });
}


/**
 * Phase 2B.2
 * Firebase Authentication verification.
 * No Firestore access yet.
 */

function apiResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function authError(code, requestId) {
  const messages = {
    UNAUTHENTICATED: "A valid login is required.",
    INVALID_ACTION: "Unsupported API operation.",
    AUTH_SERVICE_UNAVAILABLE: "Authentication service unavailable."
  };

  return apiResponse({
    ok: false,
    data: null,
    error: {
      code,
      message: messages[code] || "Request rejected."
    },
    requestId
  });
}

function verifyFirebaseToken(idToken) {
  if (
    typeof idToken !== "string" ||
    idToken.length < 20 ||
    idToken.length > 8192
  ) {
    return { ok: false, code: "UNAUTHENTICATED" };
  }

  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty("FIREBASE_WEB_API_KEY");

  if (!apiKey) {
    console.error("Firebase API configuration missing.");
    return { ok: false, code: "AUTH_SERVICE_UNAVAILABLE" };
  }

  const endpoint =
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup" +
    "?key=" + encodeURIComponent(apiKey);

  let response;

  try {
    response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken }),
      muteHttpExceptions: true
    });
  } catch (error) {
    // Never print the token or the complete request.
    console.error("Firebase Auth service request failed.");

    return {
      ok: false,
      code: "AUTH_SERVICE_UNAVAILABLE"
    };
  }

  const status = response.getResponseCode();

  if (status === 400 || status === 401) {
    return { ok: false, code: "UNAUTHENTICATED" };
  }

  if (status !== 200) {
    console.error("Firebase Auth lookup HTTP status: " + status);

    return {
      ok: false,
      code: "AUTH_SERVICE_UNAVAILABLE"
    };
  }

  try {
    const data = JSON.parse(response.getContentText());
    const firebaseUser = data.users && data.users[0];

    if (
      !firebaseUser ||
      !firebaseUser.localId ||
      firebaseUser.disabled
    ) {
      return { ok: false, code: "UNAUTHENTICATED" };
    }

    // UID comes from Firebase, never the request body.
    return {
      ok: true,
      uid: firebaseUser.localId
    };
  } catch (error) {
    console.error("Invalid Firebase Auth service response.");

    return {
      ok: false,
      code: "AUTH_SERVICE_UNAVAILABLE"
    };
  }
}

function doPost(e) {
  const requestId = Utilities.getUuid();

  let request;

  try {
    request = JSON.parse(
      e && e.postData ? e.postData.contents : ""
    );
  } catch (error) {
    console.warn(JSON.stringify({
      severity: "WARN",
      requestId,
      functionName: "doPost",
      outcome: "rejected",
      errorCode: "INVALID_REQUEST"
    }));

    return authError("UNAUTHENTICATED", requestId);
  }

  if (!request || request.action !== "verifySession") {
    return authError("INVALID_ACTION", requestId);
  }

  const authResult = verifyFirebaseToken(request.idToken);

  if (!authResult.ok) {
    console.warn(JSON.stringify({
      severity: "WARN",
      requestId,
      functionName: "doPost",
      outcome: "rejected",
      errorCode: authResult.code
    }));

    return authError(authResult.code, requestId);
  }

  console.info(JSON.stringify({
    severity: "INFO",
    requestId,
    functionName: "doPost",
    operation: "verifySession",
    outcome: "success"
  }));

  return apiResponse({
    ok: true,
    data: {
      authenticated: true,
      uid: authResult.uid
    },
    requestId
  });
}

function testFirebaseLookupSetup() {
  const key = PropertiesService.getScriptProperties()
    .getProperty("FIREBASE_WEB_API_KEY");

  if (!key) {
    throw new Error("FIREBASE_WEB_API_KEY is not configured.");
  }

  const response = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup" +
      "?key=" + encodeURIComponent(key),
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        idToken: "invalid-test-token"
      }),
      muteHttpExceptions: true
    }
  );

  console.info(
    "Firebase lookup test HTTP status: " +
      response.getResponseCode()
  );
}