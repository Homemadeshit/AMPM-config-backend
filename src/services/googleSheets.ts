import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Google Sheets service for price calculation
export class GoogleSheetsService {
  private doc: GoogleSpreadsheet;
  private bigTableSheet: any;
  private allInOneSheet: any;
  private lastRefresh: number = 0;
  private cacheTimeout: number = 30000; // 30 seconds cache

  constructor(spreadsheetId: string, serviceAccountEmail: string, privateKey: string) {
    const serviceAccountAuth = new JWT({
      email: serviceAccountEmail,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly'
      ],
    });

    this.doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
  }

  async initialize() {
    try {
      console.log('Loading Google Sheets document info...');
      await this.doc.loadInfo();
      console.log('Document loaded. Title:', this.doc.title);
      console.log('Available sheets:', Object.keys(this.doc.sheetsByTitle));
      
      this.bigTableSheet = this.doc.sheetsByTitle['Big_Table']; // Sheet named "Big_Table"
      this.allInOneSheet = this.doc.sheetsByTitle['All_in_one']; // Sheet named "All_in_one"
      
      if (!this.bigTableSheet) {
        throw new Error('Sheet "Big_Table" not found. Available sheets: ' + Object.keys(this.doc.sheetsByTitle).join(', '));
      }
      if (!this.allInOneSheet) {
        throw new Error('Sheet "All_in_one" not found. Available sheets: ' + Object.keys(this.doc.sheetsByTitle).join(', '));
      }
      
      console.log('Loading cells for both sheets...');
      await this.refreshSheetData();
      console.log('Google Sheets initialization complete!');
    } catch (error) {
      console.error('Google Sheets initialization error:', error);
      throw error;
    }
  }

  // Refresh sheet data from Google Sheets
  private async refreshSheetData() {
    console.log('Refreshing Google Sheets data...');
    await this.bigTableSheet.loadCells();
    await this.allInOneSheet.loadCells();
    this.lastRefresh = Date.now();
    console.log('Sheet data refreshed at:', new Date().toISOString());
  }

  // Check if cache needs refresh and refresh if needed
  private async ensureFreshData() {
    const now = Date.now();
    if (now - this.lastRefresh > this.cacheTimeout) {
      console.log('Cache expired, refreshing sheet data...');
      await this.refreshSheetData();
    }
  }

  // Public method to force refresh (for manual cache clearing)
  async forceRefresh() {
    console.log('Force refreshing Google Sheets data...');
    await this.refreshSheetData();
    return { success: true, refreshedAt: new Date().toISOString() };
  }

  // Big Table Price Calculation
  async calculateBigTablePrice(params: {
    dimension: string;
    quantity: number;
    delivery_days: number;
    advance_payment: number;
    is_startup_factory?: boolean;
    is_fast_order?: boolean; // 7 days
    include_delivery?: boolean; // Whether to include delivery in base price
  }) {
    // Ensure we have fresh data from Google Sheets
    await this.ensureFreshData();
    
    const { dimension, quantity, delivery_days, advance_payment, is_startup_factory, is_fast_order, include_delivery = true } = params;

    // 1. Get base price from dimension
    const dimensionPrice = this.getBigTableBasePrice(dimension);
    if (!dimensionPrice) {
      throw new Error(`Price not found for dimension: ${dimension}`);
    }

    // 2. Get delivery fee
    const deliveryFee = this.getBigTableDeliveryFee(delivery_days);
    
    // 3. Base price is always just the table price (consistent)
    const basePrice = dimensionPrice;

    // 2. Calculate total discounts
    const discounts = await this.getBigTableDiscounts();
    let totalDiscounts = 0;

    // Startup factory discount
    if (is_startup_factory) {
      totalDiscounts += discounts.startupFactory;
    }

    // Fast order discount (7 days)
    if (is_fast_order && delivery_days <= 7) {
      totalDiscounts += discounts.fastOrder7Days;
    }

    // Advance payment discounts
    if (advance_payment >= 100) {
      totalDiscounts += discounts.advancePayment100;
    } else if (advance_payment >= 50) {
      totalDiscounts += discounts.advancePayment50;
    }

    // Quantity discount (2+)
    if (quantity >= 2) {
      totalDiscounts += discounts.quantity2Plus;
    }

    // 3. Step-based calculation
    let stepPrice = basePrice; // Start with base price from Google Sheets
    
    // ALWAYS subtract startup discount first (step 1)
    if (is_startup_factory) {
      stepPrice -= discounts.startupFactory;
    }
    
    // Add delivery if requested (step 2)
    if (include_delivery) {
      stepPrice += deliveryFee;
    }
    
    // Add advance payment discount if requested (step 3+)
    if (advance_payment >= 100) {
      stepPrice -= discounts.advancePayment100;
    } else if (advance_payment >= 50) {
      stepPrice -= discounts.advancePayment50;
    }
    
    // Add other discounts
    if (is_fast_order) {
      stepPrice -= discounts.fastOrder7Days;
    }
    if (quantity >= 2) {
      stepPrice -= discounts.quantity2Plus;
    }

    const pricePerUnit = stepPrice;
    const totalPrice = pricePerUnit * quantity;

    return {
      base_price: basePrice, // Original table price from Google Sheets
      discounts_applied: totalDiscounts, // Total euro amount discounted
      delivery_fee: deliveryFee, // Delivery fee per unit
      price_per_unit: pricePerUnit, // Step-based price per unit
      quantity: quantity,
      total_price: Math.round(totalPrice), // Step-based total price
      dimension: dimension,
      delivery_days: delivery_days,
      advance_payment: advance_payment
    };
  }

  // Get base price for Big Table dimensions
  private getBigTableBasePrice(dimension: string): number {
    const dimensionMap: { [key: string]: string } = {
      '140 x 70': 'C2',
      '140 x 80': 'C3',
      '140 x 90': 'C4',
      '140 x 100': 'C5',
      '160 x 70': 'C6',
      '160 x 80': 'C7',
      '160 x 90': 'C8',
      '160 x 100': 'C9',
      '180 x 70': 'C10',
      '180 x 80': 'C11',
      '180 x 90': 'C12',
      '180 x 100': 'C13',
      '200 x 70': 'C14',
      '200 x 80': 'C15',
      '200 x 90': 'C16',
      '200 x 100': 'C17'
    };

    const cellAddress = dimensionMap[dimension];
    if (!cellAddress) {
      throw new Error(`Invalid dimension: ${dimension}`);
    }

    const cell = this.bigTableSheet.getCellByA1(cellAddress);
    return parseFloat(cell.value) || 0;
  }

  // Get all discount values for Big Table
  private async getBigTableDiscounts() {
    const e2Value = this.bigTableSheet.getCellByA1('E2').value;
    const e3Value = this.bigTableSheet.getCellByA1('E3').value;
    const e4Value = this.bigTableSheet.getCellByA1('E4').value;
    const e5Value = this.bigTableSheet.getCellByA1('E5').value;
    const e6Value = this.bigTableSheet.getCellByA1('E6').value;

    return {
      startupFactory: parseFloat(e2Value) || 0,
      fastOrder7Days: parseFloat(e3Value) || 0,
      advancePayment50: parseFloat(e4Value) || 0,
      advancePayment100: parseFloat(e5Value) || 0,
      quantity2Plus: parseFloat(e6Value) || 0
    };
  }

  // Get delivery fee for Big Table
  private getBigTableDeliveryFee(deliveryDays: number): number {
    if (deliveryDays <= 30) {
      return parseFloat(this.bigTableSheet.getCellByA1('E11').value) || 0; // 30 days
    } else if (deliveryDays <= 45) {
      return parseFloat(this.bigTableSheet.getCellByA1('E10').value) || 0; // 45 days
    } else {
      return parseFloat(this.bigTableSheet.getCellByA1('E9').value) || 0;  // 60 days
    }
  }

  // All in One Table Price Calculation
  async calculateAllInOnePrice(params: {
    has_cutting_board: boolean;
    has_water_package: boolean;
    quantity: number;
    delivery_days: number;
    advance_payment: number;
    is_startup_factory?: boolean;
    is_first_order?: boolean;
    include_delivery?: boolean; // Whether to include delivery in base price
  }) {
    const { 
      has_cutting_board, 
      has_water_package, 
      quantity, 
      delivery_days, 
      advance_payment, 
      is_startup_factory = true, // Always applied according to your note
      is_first_order,
      include_delivery = true
    } = params;

    // Ensure we have fresh data from Google Sheets
    await this.ensureFreshData();

    // 1. Get base price based on package selection
    const packagePrice = this.getAllInOneBasePrice(has_cutting_board, has_water_package);
    const packageType = this.getPackageType(has_cutting_board, has_water_package);

    // 2. Get delivery fee
    const deliveryFee = this.getAllInOneDeliveryFee(delivery_days);
    
    // 3. Base price is always just the package price (consistent)
    const basePrice = packagePrice;

    // 2. Calculate total discounts
    const discounts = await this.getAllInOneDiscounts();
    let totalDiscounts = 0;

    // Startup factory discount (always applied)
    if (is_startup_factory) {
      totalDiscounts += discounts.startupFactory;
    }

    // First order discounts (different for raw table vs all-in-one)
    if (is_first_order) {
      if (packageType === 'all_in_one') {
        totalDiscounts += discounts.firstOrderAllInOne;
      } else {
        totalDiscounts += discounts.firstOrderRawTable;
      }
    }

    // Advance payment discounts
    if (advance_payment >= 100) {
      totalDiscounts += discounts.advancePayment100;
    } else if (advance_payment >= 50) {
      totalDiscounts += discounts.advancePayment50;
    }

    // Quantity discount (2+)
    if (quantity >= 2) {
      totalDiscounts += discounts.quantity2Plus;
    }

    // 3. Step-based calculation
    let stepPrice = basePrice; // Start with base price from Google Sheets
    
    // ALWAYS subtract startup discount first (step 1)
    if (is_startup_factory) {
      stepPrice -= discounts.startupFactory;
    }
    
    // Add delivery if requested (step 2)
    if (include_delivery) {
      stepPrice += deliveryFee;
    }
    
    // Add advance payment discount if requested (step 3+)
    if (advance_payment >= 100) {
      stepPrice -= discounts.advancePayment100;
    } else if (advance_payment >= 50) {
      stepPrice -= discounts.advancePayment50;
    }
    
    // Add other discounts
    if (is_first_order) {
      if (packageType === 'all_in_one') {
        stepPrice -= discounts.firstOrderAllInOne;
      } else {
        stepPrice -= discounts.firstOrderRawTable;
      }
    }
    if (quantity >= 2) {
      stepPrice -= discounts.quantity2Plus;
    }

    const pricePerUnit = stepPrice;
    const totalPrice = pricePerUnit * quantity;

    return {
      base_price: basePrice, // Original package price from Google Sheets
      package_type: packageType,
      discounts_applied: totalDiscounts, // Total euro amount discounted
      delivery_fee: deliveryFee, // Delivery fee per unit
      price_per_unit: pricePerUnit, // Step-based price per unit
      quantity: quantity,
      total_price: Math.round(totalPrice), // Step-based total price
      has_cutting_board: has_cutting_board,
      has_water_package: has_water_package,
      delivery_days: delivery_days,
      advance_payment: advance_payment
    };
  }

  // Get base price for All in One table based on package selection
  private getAllInOneBasePrice(hasCuttingBoard: boolean, hasWaterPackage: boolean): number {
    let cellAddress: string;

    if (!hasCuttingBoard && !hasWaterPackage) {
      // Raw table only
      cellAddress = 'C2';
    } else if (hasCuttingBoard && !hasWaterPackage) {
      // Cutting board package
      cellAddress = 'C3';
    } else if (!hasCuttingBoard && hasWaterPackage) {
      // Water package
      cellAddress = 'C4';
    } else {
      // Both packages = "All in One"
      cellAddress = 'C5';
    }

    const cell = this.allInOneSheet.getCellByA1(cellAddress);
    return parseFloat(cell.value) || 0;
  }

  // Get package type description
  private getPackageType(hasCuttingBoard: boolean, hasWaterPackage: boolean): string {
    if (!hasCuttingBoard && !hasWaterPackage) {
      return 'raw_table';
    } else if (hasCuttingBoard && !hasWaterPackage) {
      return 'cutting_board_package';
    } else if (!hasCuttingBoard && hasWaterPackage) {
      return 'water_package';
    } else {
      return 'all_in_one';
    }
  }

  // Get all discount values for All in One table
  private async getAllInOneDiscounts() {
    return {
      startupFactory: parseFloat(this.allInOneSheet.getCellByA1('E2').value) || 0,
      firstOrderRawTable: parseFloat(this.allInOneSheet.getCellByA1('E3').value) || 0,
      firstOrderAllInOne: parseFloat(this.allInOneSheet.getCellByA1('E4').value) || 0,
      advancePayment50: parseFloat(this.allInOneSheet.getCellByA1('E5').value) || 0,
      advancePayment100: parseFloat(this.allInOneSheet.getCellByA1('E6').value) || 0,
      quantity2Plus: parseFloat(this.allInOneSheet.getCellByA1('E7').value) || 0
    };
  }

  // Get delivery fee for All in One table
  private getAllInOneDeliveryFee(deliveryDays: number): number {
    if (deliveryDays <= 30) {
      return parseFloat(this.allInOneSheet.getCellByA1('E12').value) || 0; // 30 days
    } else if (deliveryDays <= 45) {
      return parseFloat(this.allInOneSheet.getCellByA1('E11').value) || 0; // 45 days
    } else {
      return parseFloat(this.allInOneSheet.getCellByA1('E10').value) || 0; // 60 days
    }
  }
}
