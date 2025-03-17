import puppeteer, { Browser, Page, LaunchOptions } from 'puppeteer';
import { createCanvas, loadImage } from 'canvas';
import * as fs from 'fs';
// Types 
type PixelPoint = { x: number; y: number, id: number };
type RGB = { r: number; g: number; b: number };
type JourneyType = "web" | "image";
type TestStatus = "passed" | "failed" | "pending";
type TestResult = {
	point: PixelPoint;
	source: RGB;
	target: RGB;
	status: TestStatus;
	diff?: number;
	id: number
};

type TestTarget = "target" | "source"

// Singleton to store test state
class PixelPTestState {
	private static instance: PixelPTestState;
	private results: Map<string, TestResult[]> = new Map();

	private constructor() { }

	static getInstance(): PixelPTestState {
		if (!PixelPTestState.instance) {
			PixelPTestState.instance = new PixelPTestState();
		}
		return PixelPTestState.instance;
	}

	addResult(testId: string, result: TestResult): void {
		if (!this.results.has(testId)) {
			this.results.set(testId, [result]);
		}
		this.results.get(testId)?.push(result);
	}

	updateResult(testId: string, resultId: number, updated: TestResult) {
		let results = this.results.get(testId) || []
		results = results.map(_ => {
			if (_.id === resultId) return updated
			else return _
		})
		this.results.set(testId, results)
	}

	getResults(testId: string): TestResult[] {
		return this.results.get(testId) || [];
	}

	getResultsById(testId: string, resultId: number): TestResult | undefined {
		return this.results.get?.(testId)?.find(_ => _.id === resultId)
	}

	getAllResults(): Map<string, TestResult[]> {
		return this.results;
	}

	clearResults(testId?: string): void {
		if (testId) {
			this.results.delete(testId);
		} else {
			this.results.clear();
		}
	}
}
let next = 0
// Base Puppeteer Controller
class PuppeteerController {
	public browser: Browser | null = null;
	public page: Page | null = null;

	async init(options?: LaunchOptions): Promise<void> {
		this.browser = await puppeteer.launch(options || {
			headless: false,
		} as unknown as LaunchOptions);
		this.page = await this.browser.newPage();
		console.log("Puppeteer browser initialized");
	}

	async goTo(url: string, options?: any): Promise<void> {
		if (!this.page) throw new Error("Page not initialized. Call init() first.");
		await this.page.goto(url, options || { waitUntil: 'networkidle2' });
		console.log(`Navigated to ${url}`);
	}

	async close(): Promise<void> {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
			this.page = null;
			console.log("Browser closed");
		}
	}

	async getPixelColor(x: number, y: number): Promise<{ r: number; g: number; b: number }> {
		// const browser = await puppeteer.launch();
		// const page = await browser.newPage();
		// await page.goto('https://example.com');

		// Take a screenshot as a Uint8Array (binary encoding)
		const screenshotUint8Array = await this.page!.screenshot({ encoding: 'binary' });
		
		// Convert Uint8Array to Buffer
		const screenshotBuffer = Buffer.from(screenshotUint8Array);
		// fs.writeFileSync('screenshot.png +' + next++, screenshotBuffer);

		// Load the screenshot buffer into an image object using loadImage
		const img = await loadImage(screenshotBuffer);

		// Create a canvas with the image dimensions
		const canvas = createCanvas(img.width, img.height);
		const ctx = canvas.getContext('2d');

		// Draw the image on the canvas
		ctx.drawImage(img, 0, 0);

		// Get pixel data from the specified coordinates
		const pixelData = ctx.getImageData(x, y, 1, 1).data;


		return {
			r: pixelData[0],
			g: pixelData[1],
			b: pixelData[2]
		};
	}
}



// Journey class now inherits from PuppeteerController for web journeys
class PixelPJourney {
	readonly journeyType: JourneyType;
	readonly testId: string;
	private puppeteerController: PuppeteerController | null = null;

	constructor(journeyType: JourneyType, testId: string) {
		this.journeyType = journeyType;
		this.testId = testId;

		if (journeyType === "web") {
			this.puppeteerController = new PuppeteerController();
		}
	}

	async init(options?: LaunchOptions): Promise<void> {
		if (this.journeyType === "web" && this.puppeteerController) {
			await this.puppeteerController.init(options);
		}
	}

	async login(loginFn: (page: Page) => Promise<void>): Promise<void> {
		if (this.journeyType !== "web" || !this.puppeteerController) {
			throw new Error("Login only available for web journeys");
		}

		if (!this.puppeteerController.page) {
			throw new Error("Page not initialized. Call init() first.");
		}

		await loginFn(this.puppeteerController.page);
		console.log("Logged in");
	}

	async goTo(url: string, options?: any): Promise<void> {
		if (this.journeyType !== "web" || !this.puppeteerController) {
			throw new Error("GoTo only available for web journeys");
		}

		await this.puppeteerController.goTo(url, options);
	}

	async close(): Promise<void> {
		if (this.journeyType === "web" && this.puppeteerController) {
			await this.puppeteerController.close();
		}
	}

	// Test methods
	test = {
		async general(pointsOfInterest: PixelPoint[], target: TestTarget): Promise<void> {
			await this.capturePoints(pointsOfInterest,
				target
			);
		},

		async generalExcept(pointsOfInterest: PixelPoint[], except: PixelPoint[]): Promise<void> {
			const filteredPoints = pointsOfInterest.filter(
				point => !except.some(e => e.x === point.x && e.y === point.y)
			);
			await this.capturePoints(filteredPoints);
		},

		// Helper method to capture pixel data
		capturePoints: async (points: PixelPoint[], target?: TestTarget): Promise<void> => {
			const state = PixelPTestState.getInstance();

			for (const point of points) {
				if (this.journeyType === "web" && this.puppeteerController) {
					try {
						const rgb = await this.puppeteerController.getPixelColor(point.x, point.y);
						const prev = state.getResultsById(this.testId, point.id)
						console.log("🚀 ~ PixelPJourney ~ capturePoints: ~ prev:", prev)
						if (prev && target) {
							prev[target] = rgb as any
							state.updateResult(this.testId, point.id, prev)
							console.log("🚀 ~ PixelPJourney ~ capturePoints: ~ prev:", prev)
							continue
						}
						console.log("hey");
						
						

						state.addResult(this.testId, {
							point,
							source: rgb,
							target: { r: 0, g: 0, b: 0 },
							status: "pending",
							id: point.id
						});
						console.log(`Captured pixel at (${point.x}, ${point.y}): RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`);
					} catch (error) {
						console.error(`Failed to capture pixel at (${point.x}, ${point.y}):`, error);
					}
				}
			}
		}
	};

	// For convenient access to puppeteer page in custom scripts
	get page(): Page | null {
		return this.puppeteerController?.page || null;
	}

	get browser(): Browser | null {
		return this.puppeteerController?.browser || null;
	}
}

// Target class
class PixelPTarget {
	readonly url: string;
	readonly journey: PixelPJourney;

	constructor(url: string, testId: string, journeyType: JourneyType = "web") {
		this.url = url;
		this.journey = new PixelPJourney(journeyType, testId);
	}

	async execute(): Promise<void> {

		await this.journey.init();
		await this.journey.goTo(this.url);
		
		// Custom test steps would be called here
		await this.journey.close();
	}
}

// Comparer class
class PixelPComparer {
	private readonly sourceTarget: PixelPTarget;
	private readonly destTarget: PixelPTarget;
	private readonly testId: string;
	private readonly threshold: number;

	constructor(source: PixelPTarget, dest: PixelPTarget, testId: string, threshold: number = 0) {
		this.sourceTarget = source;
		this.destTarget = dest;
		this.testId = testId;
		this.threshold = threshold;
	}

	async compare(): Promise<boolean> {
		// Execute both targets
		await this.sourceTarget.execute();
		await this.destTarget.execute();

		const state = PixelPTestState.getInstance();
		const results = state.getResults(this.testId);

		let allPassed = true;

		for (const result of results) {
			// Calculate color difference
			const diff = Math.sqrt(
				Math.pow(result.source.r - result.target.r, 2) +
				Math.pow(result.source.g - result.target.g, 2) +
				Math.pow(result.source.b - result.target.b, 2)
			);

			result.diff = diff;
			result.status = diff <= this.threshold ? "passed" : "failed";

			if (result.status === "failed") {
				allPassed = false;
			}
		}

		this.printResults();
		return allPassed;
	}

	private printResults(): void {
		const state = PixelPTestState.getInstance();
		const results = state.getResults(this.testId);

		console.log(`\n==== PixelP Test Results: ${this.testId} ====`);
		console.log(`Source URL: ${this.sourceTarget.url}`);
		console.log(`Target URL: ${this.destTarget.url}`);
		console.log(`Total points tested: ${results.length}`);

		const passedCount = results.filter(r => r.status === "passed").length;
		const failedCount = results.filter(r => r.status === "failed").length;

		console.log(`Passed: ${passedCount}`);
		console.log(`Failed: ${failedCount}`);

		if (failedCount > 0) {
			console.log("\nFailed Points:");
			results
				.filter(r => r.status === "failed")
				.forEach(r => {
					console.log(`Point (${r.point.x}, ${r.point.y}):`);
					console.log(`  Source: RGB(${r.source.r}, ${r.source.g}, ${r.source.b})`);
					console.log(`  Target: RGB(${r.target.r}, ${r.target.g}, ${r.target.b})`);
					console.log(`  Diff: ${r.diff?.toFixed(2)}`);
				});
		}

		console.log(`\nTest ${passedCount === results.length ? 'PASSED' : 'FAILED'}`);
		console.log("==============================\n");
	}
}


async function runVisualComparisonTest() {
	// Define a unique test ID
	const testId = `visual-test-${Date.now()}`;

	// Define important UI elements to test (shared between both targets)

	const pointsOfInterest: PixelPoint[] = [
		// Header elements
		{ x: 100, y: 50 },
		{ x: 200, y: 50 },
		{ x: 300, y: 50 },

		// Logo position
		{ x: 50, y: 30 },

		// Main content area
		{ x: 500, y: 300 },
		{ x: 500, y: 400 },
		{ x: 500, y: 500 },

		// Footer elements
		{ x: 100, y: 950 },
		{ x: 300, y: 950 },
		{ x: 500, y: 950 }
	] as PixelPoint[];

	let nextIdx = 0
	pointsOfInterest.forEach(_ => _.id = nextIdx++)


	// Create source and destination targets
	const productionSite = new PixelPTarget('https://ynet.co.il', testId);
	const stagingSite = new PixelPTarget('https://example.com', testId);

	// Override the execute methods for both targets
	productionSite.execute = async function () {
		console.log(this.url);
		
		await this.journey.init();
		await this.journey.goTo(this.url);
		await this.journey.test.general(pointsOfInterest, 'source');
		await this.journey.close();
	};

	stagingSite.execute = async function () {

		await this.journey.init();
		await this.journey.goTo(this.url);
		await this.journey.test.general(pointsOfInterest, 'target');
		await this.journey.close();
	};

	// Create a comparer with a color difference threshold of 5
	const comparer = new PixelPComparer(productionSite, stagingSite, testId, 5);

	// Run the comparison
	try {
		const result = await comparer.compare();
		console.log(result
			? "✅ Visual comparison test PASSED! Production and staging match."
			: "❌ Visual comparison test FAILED! Production and staging have differences."
		);
	} catch (error) {
		console.error("❌ Error during visual comparison:", error);
	}
}

// Execute the test
runVisualComparisonTest().catch(console.error);