import mongoose from 'mongoose';

// Define a schema for storing cached report data
const reportSchema = new mongoose.Schema({
  // Report identifier
  reportName: {
    type: String,
    required: true,
    enum: [
      'revenue', 
      'shipments', 
      'orders', 
      'customers', 
      'sellers',
      'delivery',
      'courier',
      'ndr',
      'tickets'
    ],
    index: true
  },
  
  // Time period for which this report data applies
  timeRange: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'],
    index: true
  },
  
  // Date range specifics
  dateRange: {
    from: {
      type: Date,
      required: true,
      index: true
    },
    to: {
      type: Date,
      required: true,
      index: true
    }
  },
  
  // The actual report data
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Filters applied to generate this report
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // When this report was generated/updated
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  // Metadata about the report
  metadata: {
    totalRecords: Number,
    generationTime: Number, // time taken to generate in ms
    dataPoints: Number
  }
}, { timestamps: true });

// Define static methods for reports

// Method to generate revenue reports
reportSchema.statics.getRevenueReport = async function(from, to, filters = {}) {
  // Query data from orders, aggregate revenue information
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: from, $lte: to },
        ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
        ...(filters.sellerType ? { 'seller.type': filters.sellerType } : {})
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        totalRevenue: { $sum: '$amount' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.date': 1 }
    },
    {
      $project: {
        date: '$_id.date',
        revenue: '$totalRevenue',
        orders: '$orderCount',
        _id: 0
      }
    }
  ];
  
  const OrderModel = mongoose.model('SellerOrder');
  const result = await OrderModel.aggregate(pipeline);
  
  // Calculate totals
  const totalRevenue = result.reduce((sum, day) => sum + day.revenue, 0);
  const totalOrders = result.reduce((sum, day) => sum + day.orders, 0);
  
  return {
    dailyData: result,
    totals: {
      revenue: totalRevenue,
      orders: totalOrders,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
    }
  };
};

// Method to generate shipment reports
reportSchema.statics.getShipmentReport = async function(from, to, filters = {}) {
  // Query data from shipments, aggregate shipment information
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: from, $lte: to },
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.courier ? { 'courier.name': filters.courier } : {})
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          status: '$status'
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.date': 1 }
    },
    {
      $group: {
        _id: '$_id.date',
        statuses: {
          $push: {
            status: '$_id.status',
            count: '$count'
          }
        },
        totalCount: { $sum: '$count' }
      }
    },
    {
      $project: {
        date: '$_id',
        statuses: 1,
        totalCount: 1,
        _id: 0
      }
    }
  ];
  
  const ShipmentModel = mongoose.model('AdminShipment');
  const result = await ShipmentModel.aggregate(pipeline);
  
  // Get courier distribution if requested
  let courierDistribution = [];
  if (!filters.courier) {
    courierDistribution = await ShipmentModel.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to }
        }
      },
      {
        $group: {
          _id: '$courier.name',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          courier: '$_id',
          count: 1,
          _id: 0
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
  }
  
  // Get status distribution
  const statusDistribution = await ShipmentModel.aggregate([
    {
      $match: {
        createdAt: { $gte: from, $lte: to }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        _id: 0
      }
    }
  ]);
  
  return {
    timeline: result,
    courierDistribution,
    statusDistribution,
    totals: {
      shipments: result.reduce((sum, day) => sum + day.totalCount, 0)
    }
  };
};

// Method to get customer analytics
reportSchema.statics.getCustomerReport = async function(from, to, filters = {}) {
  const CustomerModel = mongoose.model('User');
  
  // Get new customers over time
  const newCustomers = await CustomerModel.aggregate([
    {
      $match: {
        createdAt: { $gte: from, $lte: to },
        role: 'customer'
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        date: '$_id',
        count: 1,
        _id: 0
      }
    },
    {
      $sort: { date: 1 }
    }
  ]);
  
  // Get active customers (those who placed orders in the period)
  const OrderModel = mongoose.model('CustomerOrder');
  const activeCustomers = await OrderModel.aggregate([
    {
      $match: {
        createdAt: { $gte: from, $lte: to }
      }
    },
    {
      $group: {
        _id: '$customer.id'
      }
    },
    {
      $count: 'activeCount'
    }
  ]);
  
  return {
    newCustomerTimeline: newCustomers,
    totals: {
      newCustomers: newCustomers.reduce((sum, day) => sum + day.count, 0),
      activeCustomers: activeCustomers.length > 0 ? activeCustomers[0].activeCount : 0
    }
  };
};

// Create and export the model
const Report = mongoose.model('Report', reportSchema);

export default Report; 