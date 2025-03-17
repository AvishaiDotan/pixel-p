"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_1 = __importDefault(require("puppeteer"));
const canvas_1 = require("canvas");
// Singleton to store test state
class PixelPTestState {
    constructor() {
        this.results = new Map();
    }
    static getInstance() {
        if (!PixelPTestState.instance) {
            PixelPTestState.instance = new PixelPTestState();
        }
        return PixelPTestState.instance;
    }
    addResult(testId, result) {
        var _a;
        if (!this.results.has(testId)) {
            this.results.set(testId, [result]);
        }
        (_a = this.results.get(testId)) === null || _a === void 0 ? void 0 : _a.push(result);
    }
    updateResult(testId, resultId, updated) {
        let results = this.results.get(testId) || [];
        results = results.map(_ => {
            if (_.id === resultId)
                return updated;
            else
                return _;
        });
        this.results.set(testId, results);
    }
    getResults(testId) {
        return this.results.get(testId) || [];
    }
    getResultsById(testId, resultId) {
        var _a, _b, _c;
        return (_c = (_b = (_a = this.results).get) === null || _b === void 0 ? void 0 : _b.call(_a, testId)) === null || _c === void 0 ? void 0 : _c.find(_ => _.id === resultId);
    }
    getAllResults() {
        return this.results;
    }
    clearResults(testId) {
        if (testId) {
            this.results.delete(testId);
        }
        else {
            this.results.clear();
        }
    }
}
let next = 0;
// Base Puppeteer Controller
class PuppeteerController {
    constructor() {
        this.browser = null;
        this.page = null;
    }
    init(options) {
        return __awaiter(this, void 0, void 0, function* () {
            this.browser = yield puppeteer_1.default.launch(options || {
                headless: false,
            });
            this.page = yield this.browser.newPage();
            console.log("Puppeteer browser initialized");
        });
    }
    goTo(url, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.page)
                throw new Error("Page not initialized. Call init() first.");
            yield this.page.goto(url, options || { waitUntil: 'networkidle2' });
            console.log(`Navigated to ${url}`);
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.browser) {
                yield this.browser.close();
                this.browser = null;
                this.page = null;
                console.log("Browser closed");
            }
        });
    }
    getPixelColor(x, y) {
        return __awaiter(this, void 0, void 0, function* () {
            // const browser = await puppeteer.launch();
            // const page = await browser.newPage();
            // await page.goto('https://example.com');
            // Take a screenshot as a Uint8Array (binary encoding)
            const screenshotUint8Array = yield this.page.screenshot({ encoding: 'binary' });
            // Convert Uint8Array to Buffer
            const screenshotBuffer = Buffer.from(screenshotUint8Array);
            // fs.writeFileSync('screenshot.png +' + next++, screenshotBuffer);
            // Load the screenshot buffer into an image object using loadImage
            const img = yield (0, canvas_1.loadImage)(screenshotBuffer);
            // Create a canvas with the image dimensions
            const canvas = (0, canvas_1.createCanvas)(img.width, img.height);
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
        });
    }
}
// Journey class now inherits from PuppeteerController for web journeys
class PixelPJourney {
    constructor(journeyType, testId) {
        this.puppeteerController = null;
        // Test methods
        this.test = {
            general(pointsOfInterest, target) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield this.capturePoints(pointsOfInterest, target);
                });
            },
            generalExcept(pointsOfInterest, except) {
                return __awaiter(this, void 0, void 0, function* () {
                    const filteredPoints = pointsOfInterest.filter(point => !except.some(e => e.x === point.x && e.y === point.y));
                    yield this.capturePoints(filteredPoints);
                });
            },
            // Helper method to capture pixel data
            capturePoints: (points, target) => __awaiter(this, void 0, void 0, function* () {
                const state = PixelPTestState.getInstance();
                for (const point of points) {
                    if (this.journeyType === "web" && this.puppeteerController) {
                        try {
                            const rgb = yield this.puppeteerController.getPixelColor(point.x, point.y);
                            const prev = state.getResultsById(this.testId, point.id);
                            console.log("🚀 ~ PixelPJourney ~ capturePoints: ~ prev:", prev);
                            if (prev && target) {
                                prev[target] = rgb;
                                state.updateResult(this.testId, point.id, prev);
                                console.log("🚀 ~ PixelPJourney ~ capturePoints: ~ prev:", prev);
                                continue;
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
                        }
                        catch (error) {
                            console.error(`Failed to capture pixel at (${point.x}, ${point.y}):`, error);
                        }
                    }
                }
            })
        };
        this.journeyType = journeyType;
        this.testId = testId;
        if (journeyType === "web") {
            this.puppeteerController = new PuppeteerController();
        }
    }
    init(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.journeyType === "web" && this.puppeteerController) {
                yield this.puppeteerController.init(options);
            }
        });
    }
    login(loginFn) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.journeyType !== "web" || !this.puppeteerController) {
                throw new Error("Login only available for web journeys");
            }
            if (!this.puppeteerController.page) {
                throw new Error("Page not initialized. Call init() first.");
            }
            yield loginFn(this.puppeteerController.page);
            console.log("Logged in");
        });
    }
    goTo(url, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.journeyType !== "web" || !this.puppeteerController) {
                throw new Error("GoTo only available for web journeys");
            }
            yield this.puppeteerController.goTo(url, options);
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.journeyType === "web" && this.puppeteerController) {
                yield this.puppeteerController.close();
            }
        });
    }
    // For convenient access to puppeteer page in custom scripts
    get page() {
        var _a;
        return ((_a = this.puppeteerController) === null || _a === void 0 ? void 0 : _a.page) || null;
    }
    get browser() {
        var _a;
        return ((_a = this.puppeteerController) === null || _a === void 0 ? void 0 : _a.browser) || null;
    }
}
// Target class
class PixelPTarget {
    constructor(url, testId, journeyType = "web") {
        this.url = url;
        this.journey = new PixelPJourney(journeyType, testId);
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.journey.init();
            yield this.journey.goTo(this.url);
            // Custom test steps would be called here
            yield this.journey.close();
        });
    }
}
// Comparer class
class PixelPComparer {
    constructor(source, dest, testId, threshold = 0) {
        this.sourceTarget = source;
        this.destTarget = dest;
        this.testId = testId;
        this.threshold = threshold;
    }
    compare() {
        return __awaiter(this, void 0, void 0, function* () {
            // Execute both targets
            yield this.sourceTarget.execute();
            yield this.destTarget.execute();
            const state = PixelPTestState.getInstance();
            const results = state.getResults(this.testId);
            let allPassed = true;
            for (const result of results) {
                // Calculate color difference
                const diff = Math.sqrt(Math.pow(result.source.r - result.target.r, 2) +
                    Math.pow(result.source.g - result.target.g, 2) +
                    Math.pow(result.source.b - result.target.b, 2));
                result.diff = diff;
                result.status = diff <= this.threshold ? "passed" : "failed";
                if (result.status === "failed") {
                    allPassed = false;
                }
            }
            this.printResults();
            return allPassed;
        });
    }
    printResults() {
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
                var _a;
                console.log(`Point (${r.point.x}, ${r.point.y}):`);
                console.log(`  Source: RGB(${r.source.r}, ${r.source.g}, ${r.source.b})`);
                console.log(`  Target: RGB(${r.target.r}, ${r.target.g}, ${r.target.b})`);
                console.log(`  Diff: ${(_a = r.diff) === null || _a === void 0 ? void 0 : _a.toFixed(2)}`);
            });
        }
        console.log(`\nTest ${passedCount === results.length ? 'PASSED' : 'FAILED'}`);
        console.log("==============================\n");
    }
}
function runVisualComparisonTest() {
    return __awaiter(this, void 0, void 0, function* () {
        // Define a unique test ID
        const testId = `visual-test-${Date.now()}`;
        // Define important UI elements to test (shared between both targets)
        const pointsOfInterest = [
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
        ];
        let nextIdx = 0;
        pointsOfInterest.forEach(_ => _.id = nextIdx++);
        // Create source and destination targets
        const productionSite = new PixelPTarget('https://ynet.co.il', testId);
        const stagingSite = new PixelPTarget('https://example.com', testId);
        // Override the execute methods for both targets
        productionSite.execute = function () {
            return __awaiter(this, void 0, void 0, function* () {
                console.log(this.url);
                yield this.journey.init();
                yield this.journey.goTo(this.url);
                yield this.journey.test.general(pointsOfInterest, 'source');
                yield this.journey.close();
            });
        };
        stagingSite.execute = function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield this.journey.init();
                yield this.journey.goTo(this.url);
                yield this.journey.test.general(pointsOfInterest, 'target');
                yield this.journey.close();
            });
        };
        // Create a comparer with a color difference threshold of 5
        const comparer = new PixelPComparer(productionSite, stagingSite, testId, 5);
        // Run the comparison
        try {
            const result = yield comparer.compare();
            console.log(result
                ? "✅ Visual comparison test PASSED! Production and staging match."
                : "❌ Visual comparison test FAILED! Production and staging have differences.");
        }
        catch (error) {
            console.error("❌ Error during visual comparison:", error);
        }
    });
}
// Execute the test
runVisualComparisonTest().catch(console.error);
