import { GoogleSheetsService } from './googleSheets';
import { z } from 'zod';

// Updated schema for Google Sheets integration
export const PriceRequestSchema = z.object({
  product_type: z.enum(['big_table', 'all_in_one']),
  
  // Big Table specific fields
  dimension: z.string().optional(), // Required for big_table
  is_fast_order: z.boolean().default(false), // 7 days or less (big_table only)
  include_delivery: z.boolean().default(true), // Whether to include delivery in base price
  
  // All-in-One specific fields
  has_cutting_board: z.boolean().default(false), // all_in_one only
  has_water_package: z.boolean().default(false), // all_in_one only
  is_first_order: z.boolean().default(false), // all_in_one only
  
  // Common fields
  quantity: z.number().min(1).max(500).default(1),
  delivery_days: z.number().min(7).max(60),
  advance_payment: z.number().min(0).max(100).default(0), // Percentage
  is_startup_factory: z.boolean().default(true) // Always applied for all_in_one
});

export type PriceRequest = z.infer<typeof PriceRequestSchema>;

export class PriceCalculatorService {
  private googleSheets: GoogleSheetsService;
  private initialized = false;

  constructor() {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      throw new Error('Missing Google Sheets configuration in environment variables');
    }

    this.googleSheets = new GoogleSheetsService(spreadsheetId, serviceAccountEmail, privateKey);
  }

  async initialize() {
    if (!this.initialized) {
      await this.googleSheets.initialize();
      this.initialized = true;
    }
  }

  async calculatePrice(request: PriceRequest) {
    await this.initialize();

    // Validate request
    const validatedRequest = PriceRequestSchema.parse(request);

    if (validatedRequest.product_type === 'big_table') {
      return await this.calculateBigTablePrice(validatedRequest);
    } else if (validatedRequest.product_type === 'all_in_one') {
      return await this.calculateAllInOnePrice(validatedRequest);
    } else {
      throw new Error(`Unsupported product type: ${validatedRequest.product_type}`);
    }
  }

  private async calculateBigTablePrice(request: PriceRequest) {
    if (!request.dimension) {
      throw new Error('Dimension is required for big_table product type');
    }

    // Validate dimension format and availability
    const validDimensions = [
      '140 x 70', '140 x 80', '140 x 90', '140 x 100',
      '160 x 70', '160 x 80', '160 x 90', '160 x 100',
      '180 x 70', '180 x 80', '180 x 90', '180 x 100',
      '200 x 70', '200 x 80', '200 x 90', '200 x 100'
    ];

    if (!validDimensions.includes(request.dimension)) {
      throw new Error(`Invalid dimension: ${request.dimension}. Valid dimensions: ${validDimensions.join(', ')}`);
    }

    const result = await this.googleSheets.calculateBigTablePrice({
      dimension: request.dimension,
      quantity: request.quantity,
      delivery_days: request.delivery_days,
      advance_payment: request.advance_payment,
      is_startup_factory: request.is_startup_factory,
      is_fast_order: request.is_fast_order,
      include_delivery: request.include_delivery
    });

    return {
      success: true,
      product_type: 'big_table',
      ...result,
      calculation_timestamp: new Date().toISOString()
    };
  }

  private async calculateAllInOnePrice(request: PriceRequest) {
    const result = await this.googleSheets.calculateAllInOnePrice({
      has_cutting_board: request.has_cutting_board,
      has_water_package: request.has_water_package,
      quantity: request.quantity,
      delivery_days: request.delivery_days,
      advance_payment: request.advance_payment,
      is_startup_factory: request.is_startup_factory,
      is_first_order: request.is_first_order,
      include_delivery: request.include_delivery
    });

    return {
      success: true,
      product_type: 'all_in_one',
      ...result,
      calculation_timestamp: new Date().toISOString()
    };
  }

  // Force refresh Google Sheets cache
  async forceRefreshCache() {
    return await this.googleSheets.forceRefresh();
  }

  // Helper method to get available dimensions (for Big Table)
  getAvailableDimensions() {
    return [
      '140 x 70', '140 x 80', '140 x 90', '140 x 100',
      '160 x 70', '160 x 80', '160 x 90', '160 x 100',
      '180 x 70', '180 x 80', '180 x 90', '180 x 100',
      '200 x 70', '200 x 80', '200 x 90', '200 x 100'
    ];
  }

  // Helper method to get available package options (for All-in-One)
  getAvailablePackages() {
    return [
      {
        id: 'raw_table',
        name: 'Raw Table Only',
        has_cutting_board: false,
        has_water_package: false,
        description: 'Basic stainless steel table without addons'
      },
      {
        id: 'cutting_board_package',
        name: 'Cutting Board Package',
        has_cutting_board: true,
        has_water_package: false,
        description: 'Table with cutting board addon'
      },
      {
        id: 'water_package',
        name: 'Water Package',
        has_cutting_board: false,
        has_water_package: true,
        description: 'Table with water system addon'
      },
      {
        id: 'all_in_one',
        name: 'All-in-One Package',
        has_cutting_board: true,
        has_water_package: true,
        description: 'Complete package with both cutting board and water system'
      }
    ];
  }
}
