import request from "supertest"; // Supertest lets us send HTTP requests directly to the Express app without starting a real server.
import dotenv from "dotenv"; // Load environment variables (needed for JWT_SECRET).
dotenv.config();
import app from "./app.js"; // The Express application under test.
import jwt from "jsonwebtoken"; // Used to generate a valid JWT token for protected-route tests.
import * as todoRepo from "./repository/todoRepository.js"; // The in-memory repository — used to reset state between tests.

/**
 * Helper: generates a valid JWT token for use in authenticated requests.
 * The token is signed with the same JWT_SECRET the server uses, so the 'auth' middleware accepts it.
 * @param {string} email - Payload value; any string works for testing purposes.
 * @returns {string} A signed JWT token string.
 */
const getToken = (email = "student@example.com") => jwt.sign({ email }, process.env.JWT_SECRET);

// --- Test isolation ---

// beforeEach runs before every individual test.
// Resetting the repository ensures each test starts with an empty task list,
// so tests cannot interfere with one another.
beforeEach(() => {
	todoRepo.reset();
});

// --- Test cases ---

/**
 * Test 1: GET / (fetch all tasks)
 * Goal: verify the endpoint returns HTTP 200 and a JSON array.
 */
test("1) GET / returns a list (200 + array)", async () => {
	// Send a GET request to '/'. request(app) routes it directly through Express.
	const res = await request(app).get("/");

	// The response status code must be 200 (OK).
	expect(res.status).toBe(200);

	// The response body must be a JavaScript array.
	expect(Array.isArray(res.body)).toBe(true);
});

/**
 * Test 2: POST /create without authentication
 * Goal: verify the endpoint is protected and returns 401 Unauthorized when no token is provided.
 */
test("2) POST /create without a token → 401", async () => {
	const res = await request(app)
		.post("/create")
		.send({ task: { description: "X" } }); // Send body data — the request should still be rejected.

	// Expect 401 because the 'auth' middleware blocks unauthenticated requests.
	expect(res.status).toBe(401);
});

/**
 * Test 3: POST /create with a valid token
 * Goal: verify that a task is created successfully and the response includes an 'id' field.
 */
test("3) POST /create with a token → 201 + id", async () => {
	const token = getToken(); // Generate a valid JWT for this request.

	const res = await request(app)
		.post("/create")
		.set("Authorization", token) // Set the Authorization header — this satisfies the 'auth' middleware.
		.send({ task: { description: "Test task" } });

	// 201 Created indicates the resource was successfully added to the in-memory store.
	expect(res.status).toBe(201);

	// The returned object must have an 'id' property assigned by the repository.
	expect(res.body).toHaveProperty("id");
});

/**
 * Test 4: POST /create with a valid token but missing body data
 * Goal: verify that the server rejects the request with 400 Bad Request when the description is absent.
 */
test("4) POST /create with missing data → 400", async () => {
	const token = getToken(); // A token is required so we test input validation, not authentication.

	const res = await request(app).post("/create").set("Authorization", token).send({ task: null }); // Send deliberately incomplete data.

	// 400 Bad Request — the validation logic in the router rejects this.
	expect(res.status).toBe(400);

	// The error response body must include an 'error' property.
	expect(res.body).toHaveProperty("error");
});

/**
 * Created task appears in GET /
 *
 *
 */
test("5) Created task appears in GET /", async () => {
	const token = getToken(); // Generate a valid JWT for this request.

	// Create a task.
	await request(app)
		.post("/create")
		.set("Authorization", token)
		.send({ task: { description: "Test task" } });

	// Then, fetch all tasks.
	const res = await request(app).get("/");

	// Expect 200 OK and an array with one item.
	expect(res.status).toBe(200);
	expect(Array.isArray(res.body)).toBe(true);
	expect(res.body.length).toBe(1);
	expect(res.body[0].description).toBe("Test task");
});

/*
 * POST /create with invalid tocken → 401
 *
 */
test("6) POST /create with invalid token → 401", async () => {
	// Create a task.
	const res = await request(app)
		.post("/create")
		.set("Authorization", "invalid-token")
		.send({ task: { description: "Test task" } });

	// Expect 401 because the 'auth' middleware blocks requests with invalid tokens.
	expect(res.status).toBe(401);
	//console.log(res.body);
	expect(res.body.message).toBe("Failed to authenticate token");
});

/*
 * DELETE /1 removes task
 *
 */
test("7) DELETE /delete/:id removes task", async () => {
	const token = getToken();

	// Create a task to delete.
	const createRes = await request(app)
		.post("/create")
		.set("Authorization", token)
		.send({ task: { description: "Task to delete" } });
	//console.log(createRes.body);
	//const taskId = createRes.body.id;
	const taskId = 1;

	// Delete the task.
	const deleteRes = await request(app).delete(`/1`).set("Authorization", token);
	expect(deleteRes.status).toBe(204);
	//console.log(deleteRes.body);

	// Verify the task is removed.
	const getRes = await request(app).get("/");
	//console.log(getRes.body);
	expect(getRes.status).toBe(200);
	expect(getRes.body.length).toBe(0);
});

/*
 * DELETE /999 returns 404
 *
 */
test("8) DELETE /delete/:id returns 404 for non-existent task", async () => {
	const token = getToken();

	const taskId = 999;

	// try to delete the task.
	const deleteRes = await request(app).delete(`/${taskId}`).set("Authorization", token);
	expect(deleteRes.status).toBe(404);
	//console.log(deleteRes.body);
});

/*
 * POST /create with too short description → 400
 */
test("9) POST /create with too short description → 400", async () => {
	const token = getToken(); // Generate a valid JWT for this request.

	const res = await request(app)
		.post("/create")
		.set("Authorization", token) // Set the Authorization header — this satisfies the 'auth' middleware.
		.send({ task: { description: "A" } });

	// 400 Bad Request indicates the resource was rejected due to validation.
	expect(res.status).toBe(400);

	// The returned error object must have an 'error' property.
	expect(res.body).toHaveProperty("error");
	expect(res.body.error).toBe("Description too short");
});

/*
 * GET / when no tasks exist → returns empty array
 */
test("10) GET / with no tasks → returns empty array", async () => {
	const res = await request(app).get("/");
	expect(res.status).toBe(200);
	//console.log(res.body);
	// check that the response body is an empty array
	expect(Array.isArray(res.body)).toBe(true);
	expect(res.body.length).toBe(0);
});
