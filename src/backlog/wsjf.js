class WSJFScoring {
  constructor() {
    this.fibonacci = [1, 2, 3, 5, 8, 13];
    this.maxAgingMultiplier = 2.0;
  }

  calculateWSJF(item) {
    const { value, time_criticality, risk_reduction, effort, created_at } = item;
    
    // Check for zero effort first, before validation
    if (effort === 0) {
      throw new Error('Effort cannot be zero for WSJF calculation');
    }
    
    // Validate inputs are in fibonacci sequence
    const validatedValue = this.validateFibonacci(value, 'value');
    const validatedTimeCriticality = this.validateFibonacci(time_criticality, 'time_criticality');
    const validatedRiskReduction = this.validateFibonacci(risk_reduction, 'risk_reduction');
    const validatedEffort = this.validateFibonacci(effort, 'effort');
    
    // Calculate base WSJF
    const costOfDelay = validatedValue + validatedTimeCriticality + validatedRiskReduction;
    const baseWSJF = costOfDelay / validatedEffort;
    
    // Apply aging multiplier
    const agingMultiplier = this.calculateAgingMultiplier(created_at);
    const finalWSJF = baseWSJF * agingMultiplier;
    
    return {
      base_wsjf: Math.round(baseWSJF * 100) / 100,
      aging_multiplier: Math.round(agingMultiplier * 100) / 100,
      final_wsjf: Math.round(finalWSJF * 100) / 100,
      cost_of_delay: costOfDelay,
      validated_scores: {
        value: validatedValue,
        time_criticality: validatedTimeCriticality,
        risk_reduction: validatedRiskReduction,
        effort: validatedEffort
      }
    };
  }

  validateFibonacci(value, fieldName) {
    if (typeof value !== 'number' || value < 1) {
      console.warn(`Invalid ${fieldName}: ${value}, defaulting to 3`);
      return 3;
    }
    
    // Find closest fibonacci number
    const closest = this.fibonacci.reduce((prev, curr) => 
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
    
    if (closest !== value) {
      console.warn(`${fieldName} ${value} adjusted to nearest fibonacci: ${closest}`);
    }
    
    return closest;
  }

  calculateAgingMultiplier(createdAt) {
    if (!createdAt) return 1.0;
    
    try {
      const created = new Date(createdAt);
      const now = new Date();
      const daysOld = (now - created) / (1000 * 60 * 60 * 24);
      
      // Apply aging: linear increase up to max multiplier over 90 days
      const agingFactor = Math.min(daysOld / 90, 1.0);
      return 1.0 + (agingFactor * (this.maxAgingMultiplier - 1.0));
    } catch (error) {
      console.warn(`Invalid date format: ${createdAt}`);
      return 1.0;
    }
  }

  scoreAndSortBacklog(items) {
    const scoredItems = items.map(item => {
      try {
        const wsjfData = this.calculateWSJF(item);
        return {
          ...item,
          wsjf: wsjfData
        };
      } catch (error) {
        console.error(`Error scoring item ${item.id}:`, error.message);
        return {
          ...item,
          wsjf: {
            base_wsjf: 0,
            aging_multiplier: 1.0,
            final_wsjf: 0,
            cost_of_delay: 0,
            validated_scores: {
              value: 3,
              time_criticality: 3,
              risk_reduction: 3,
              effort: 3
            }
          }
        };
      }
    });

    // Sort by final WSJF descending
    return scoredItems.sort((a, b) => b.wsjf.final_wsjf - a.wsjf.final_wsjf);
  }

  getActionableItems(items, scopeFilter = null) {
    const actionableStatuses = ['NEW', 'REFINED', 'READY'];
    
    let filtered = items.filter(item => actionableStatuses.includes(item.status));
    
    if (scopeFilter) {
      filtered = filtered.filter(item => scopeFilter(item));
    }
    
    return filtered;
  }

  getNextReadyItem(items, scopeFilter = null) {
    const actionable = this.getActionableItems(items, scopeFilter);
    
    // Prefer READY items, then REFINED, then NEW
    const priorities = ['READY', 'REFINED', 'NEW'];
    
    for (const status of priorities) {
      const candidates = actionable.filter(item => item.status === status);
      if (candidates.length > 0) {
        return candidates[0]; // Already sorted by WSJF
      }
    }
    
    return null;
  }

  updateItemStatus(items, itemId, newStatus) {
    const item = items.find(i => i.id === itemId);
    if (item) {
      item.status = newStatus;
      if (newStatus === 'DONE') {
        item.completed_at = new Date().toISOString().split('T')[0];
      }
    }
    return items;
  }

  getBacklogMetrics(items) {
    const statusCounts = items.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    const completedItems = items.filter(item => item.status === 'DONE' && item.completed_at);
    const avgCycleTime = this.calculateAverageCycleTime(completedItems);

    const topItems = items
      .filter(item => ['NEW', 'REFINED', 'READY'].includes(item.status))
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        title: item.title,
        wsjf: item.wsjf?.final_wsjf || 0,
        status: item.status
      }));

    return {
      backlog_size_by_status: statusCounts,
      avg_cycle_time_hours: avgCycleTime,
      top_wsjf_items: topItems,
      total_items: items.length
    };
  }

  calculateAverageCycleTime(completedItems) {
    if (completedItems.length === 0) return 0;

    const cycleTimes = completedItems
      .filter(item => item.created_at && item.completed_at)
      .map(item => {
        const created = new Date(item.created_at);
        const completed = new Date(item.completed_at);
        return (completed - created) / (1000 * 60 * 60); // hours
      });

    if (cycleTimes.length === 0) return 0;

    return Math.round(cycleTimes.reduce((sum, time) => sum + time, 0) / cycleTimes.length);
  }
}

module.exports = WSJFScoring;