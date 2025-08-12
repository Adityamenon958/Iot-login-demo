import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ✅ Comprehensive PDF Export Service for Crane Analysis Reports
export class PDFExportService {
  constructor() {
    this.doc = null;
    this.pageWidth = 210; // A4 width in mm
    this.pageHeight = 297; // A4 height in mm
    this.margin = 20; // margin in mm
    this.yPosition = 30; // starting Y position
  }

  // ✅ Helper function to convert decimal hours to hours:minutes format
  formatHoursToHoursMinutes(decimalHours) {
    if (!decimalHours || decimalHours === 0) return '0h 0m';
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${hours}h ${minutes}m`;
  }

  // ✅ Initialize PDF document
  initDocument(companyName, reportDate) {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.yPosition = 30;
    
    // Add company header
    this.addHeader(companyName, reportDate);
  }

  // ✅ Add company header to PDF
  addHeader(companyName, reportDate) {
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Crane Analysis Report', this.margin, this.yPosition);
    
    this.yPosition += 10;
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Company: ${companyName}`, this.margin, this.yPosition);
    
    this.yPosition += 8;
    // ✅ Add current time to report date
    const currentTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    this.doc.text(`Report Date: ${reportDate} at ${currentTime}`, this.margin, this.yPosition);
    
    this.yPosition += 15;
    this.addSeparator();
  }

  // ✅ Add separator line
  addSeparator() {
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, this.yPosition, this.pageWidth - this.margin, this.yPosition);
    this.yPosition += 10;
  }

  // ✅ Add section title
  addSectionTitle(title) {
    // Check if we need a new page
    if (this.yPosition > this.pageHeight - 60) {
      this.doc.addPage();
      this.yPosition = 30;
    }
    
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.yPosition);
    this.yPosition += 10;
  }

  // ✅ Check and add new page if needed
  checkPageBreak(requiredSpace = 20) {
    if (this.yPosition + requiredSpace > this.pageHeight - 40) {
      this.doc.addPage();
      this.yPosition = 30;
      return true;
    }
    return false;
  }

  // ✅ Add comprehensive executive summary
  addExecutiveSummary(data) {
    this.addSectionTitle('Executive Summary');
    
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    
    const { sessionsData, cumulativeStats, movementAnalysis, summary, timePeriods } = data;
    
    // ✅ Calculate completed vs ongoing hours
    const completedHours = Math.round(cumulativeStats.overall.workingCompleted * 100) / 100;
    const ongoingHours = Math.round(cumulativeStats.overall.workingOngoing * 100) / 100;
    const totalWorkingHours = completedHours + ongoingHours;
    
    // ✅ Add time period information (without emojis to avoid encoding issues)
    if (timePeriods) {
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Analysis Period:', this.margin, this.yPosition);
      this.yPosition += 6;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      
      // Show selected months
      if (timePeriods.selectedMonths && timePeriods.selectedMonths.length > 0) {
        const monthsText = timePeriods.selectedMonths.join(', ');
        this.doc.text(`  Months: ${monthsText}`, this.margin + 5, this.yPosition);
        this.yPosition += 5;
      }
      
      // Show selected cranes
      if (timePeriods.selectedCranes && timePeriods.selectedCranes.length > 0) {
        const cranesText = timePeriods.selectedCranes.join(', ');
        this.doc.text(`  Cranes: ${cranesText}`, this.margin + 5, this.yPosition);
        this.yPosition += 5;
      }
      
      // Show report generation time
      if (timePeriods.reportGeneratedAt) {
        this.doc.text(`  Generated: ${timePeriods.reportGeneratedAt}`, this.margin + 5, this.yPosition);
        this.yPosition += 5;
      }
      
      this.yPosition += 5;
    }
    
    const summaryData = [
      { label: 'Total Cranes Analyzed', value: summary.totalCranes },
      { label: 'Total Sessions Recorded', value: summary.totalSessions },
      { label: 'Total Logs Processed', value: summary.totalLogs },
      { label: 'Analysis Period', value: `${summary.totalMonths} month(s)` },
      { label: 'Total Working Hours', value: `${this.formatHoursToHoursMinutes(completedHours)} + ${this.formatHoursToHoursMinutes(ongoingHours)} ongoing` },
      { label: 'Total Maintenance Hours', value: `${this.formatHoursToHoursMinutes(cumulativeStats.overall.maintenance)}` },
      { label: 'Total Distance Traveled', value: `${this.calculateTotalDistance(movementAnalysis)}m` }
    ];

    summaryData.forEach(stat => {
      this.doc.text(`${stat.label}: ${stat.value}`, this.margin, this.yPosition);
      this.yPosition += 8;
    });

    this.yPosition += 10;
    this.addSeparator();
  }

  // ✅ Add charts section to PDF
  async addChartsSection() {
    this.addSectionTitle('Visual Analysis Charts');
    
    try {
      // ✅ Add Monthly Chart (Line Chart) - First chart
      const monthlyChartElements = document.querySelectorAll('.recharts-wrapper');
      if (monthlyChartElements.length > 0) {
        await this.addElementAsImage(monthlyChartElements[0], 'Monthly Working Hours Trend');
      }
      
      // ✅ Add Crane Bar Chart - Second chart
      if (monthlyChartElements.length > 1) {
        await this.addElementAsImage(monthlyChartElements[1], 'Crane Performance Analysis');
      }
      
      // ✅ Add Distance Chart
      const distanceChartElement = document.querySelector('.chartContainer');
      if (distanceChartElement) {
        await this.addElementAsImage(distanceChartElement, 'Crane Distance Analysis');
      }
      
    } catch (error) {
      console.log('❌ Error adding charts to PDF:', error);
      this.doc.text('Charts could not be included in this report.', this.margin, this.yPosition);
      this.yPosition += 10;
    }
  }

  // ✅ Add sessions table (start/stop times)
  addSessionsTable(sessionsData) {
    this.addSectionTitle('Crane Sessions Analysis');
    
    if (sessionsData.length === 0) {
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('No sessions data available for the selected period.', this.margin, this.yPosition);
      this.yPosition += 15;
      return;
    }

    // ✅ Fixed table layout to prevent cropping
    const headers = ['Crane', 'Type', 'Start Time', 'End Time', 'Duration', 'Start Location', 'End Location'];
    const colWidths = [22, 25, 32, 32, 20, 28, 28]; // Adjusted widths to fit page
    let xPos = this.margin;

    // Draw headers
    this.doc.setFontSize(8); // Smaller font for headers
    this.doc.setFont('helvetica', 'bold');
    headers.forEach((header, index) => {
      this.doc.text(header, xPos, this.yPosition);
      xPos += colWidths[index];
    });

    this.yPosition += 8;

    // Draw data rows
    this.doc.setFontSize(7); // Smaller font for data to fit more content
    this.doc.setFont('helvetica', 'normal');
    
    sessionsData.forEach(session => {
      // Check if we need a new page
      if (this.yPosition > this.pageHeight - 40) {
        this.doc.addPage();
        this.yPosition = 30;
      }

      xPos = this.margin;
      
      // ✅ Handle ongoing sessions (show "Running" for end time)
      const endTime = session.endTime === 'Session Data' || !session.endTime ? 'Running' : session.endTime;
      const endLocation = session.endLocation?.lat === 'N/A' ? 'N/A' : `${session.endLocation?.lat}, ${session.endLocation?.lon}`;
      
      const rowData = [
        session.craneId,
        session.sessionType,
        session.startTime === 'Session Data' ? 'N/A' : session.startTime,
        endTime,
        this.formatHoursToHoursMinutes(session.duration),
        session.startLocation?.lat === 'N/A' ? 'N/A' : `${session.startLocation?.lat}, ${session.startLocation?.lon}`,
        endLocation
      ];
      
      rowData.forEach((cell, index) => {
        // ✅ Better text truncation for each column
        let maxWidth = colWidths[index] - 1;
        let truncatedCell = this.truncateText(cell.toString(), maxWidth);
        
        // ✅ Special handling for specific columns
        if (index === 3 && cell === 'Running') { // End Time column
          truncatedCell = 'Running';
        } else if (index === 4) { // Duration column
          truncatedCell = this.formatHoursToHoursMinutes(session.duration);
        }
        
        this.doc.text(truncatedCell, xPos, this.yPosition);
        xPos += colWidths[index];
      });

      this.yPosition += 6;
    });

    this.yPosition += 10;
  }

  // ✅ Add cumulative statistics
  addCumulativeStatistics(cumulativeStats, timePeriods) {
    this.addSectionTitle('Cumulative Statistics');
    
    // ✅ Add time period information (without emojis)
    if (timePeriods) {
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Data Period:', this.margin, this.yPosition);
      this.yPosition += 6;
      
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      
      if (timePeriods.selectedMonths && timePeriods.selectedMonths.length > 0) {
        const monthsText = timePeriods.selectedMonths.join(', ');
        this.doc.text(`  Period: ${monthsText}`, this.margin + 5, this.yPosition);
        this.yPosition += 5;
      }
      
      this.yPosition += 5;
    }
    
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Overall Statistics:', this.margin, this.yPosition);
    this.yPosition += 8;

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    
    const overallStats = [
      { label: 'Total Working Hours', value: `${this.formatHoursToHoursMinutes(cumulativeStats.overall.workingCompleted)} + ${this.formatHoursToHoursMinutes(cumulativeStats.overall.workingOngoing)} ongoing` },
      { label: 'Total Idle Hours', value: `${this.formatHoursToHoursMinutes(cumulativeStats.overall.idle)}` },
      { label: 'Total Maintenance Hours', value: `${this.formatHoursToHoursMinutes(cumulativeStats.overall.maintenanceCompleted)} + ${this.formatHoursToHoursMinutes(cumulativeStats.overall.maintenanceOngoing)} ongoing` },
      { label: 'Total Hours', value: `${this.formatHoursToHoursMinutes(cumulativeStats.overall.total)}` }
    ];

    overallStats.forEach(stat => {
      this.doc.text(`${stat.label}: ${stat.value}`, this.margin + 5, this.yPosition);
      this.yPosition += 6;
    });

    this.yPosition += 8;

    // Individual crane statistics
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Individual Crane Statistics:', this.margin, this.yPosition);
    this.yPosition += 8;

    Object.entries(cumulativeStats.byCrane).forEach(([craneId, stats]) => {
      // Check if we need a new page for this crane
      this.checkPageBreak(30);
      
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`Crane ${craneId}:`, this.margin, this.yPosition);
      this.yPosition += 6;

      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      
      const craneStats = [
        { label: 'Working Hours', value: `${this.formatHoursToHoursMinutes(stats.workingCompleted)} + ${this.formatHoursToHoursMinutes(stats.workingOngoing)} ongoing` },
        { label: 'Idle Hours', value: `${this.formatHoursToHoursMinutes(stats.idle)}` },
        { label: 'Maintenance Hours', value: `${this.formatHoursToHoursMinutes(stats.maintenanceCompleted)} + ${this.formatHoursToHoursMinutes(stats.maintenanceOngoing)} ongoing` },
        { label: 'Total Hours', value: `${this.formatHoursToHoursMinutes(stats.total)}` }
      ];

      craneStats.forEach(stat => {
        this.doc.text(`  ${stat.label}: ${stat.value}`, this.margin + 5, this.yPosition);
        this.yPosition += 5;
      });

      this.yPosition += 5;
    });

    this.yPosition += 10;
  }

  // ✅ Add movement analysis
  addMovementAnalysis(movementAnalysis) {
    try {
      console.log('🔍 Adding movement analysis with data:', movementAnalysis);
      this.addSectionTitle('Movement Analysis');
      
      if (!movementAnalysis || !movementAnalysis.byCrane) {
        console.log('❌ No movement analysis data available');
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text('No movement data available for the selected period.', this.margin, this.yPosition);
        this.yPosition += 15;
        return;
      }
      
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Crane Movement Summary:', this.margin, this.yPosition);
      this.yPosition += 8;

      Object.entries(movementAnalysis.byCrane).forEach(([craneId, data]) => {
        // Check if we need a new page for this crane
        this.checkPageBreak(30);
        
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`Crane ${craneId}:`, this.margin, this.yPosition);
        this.yPosition += 6;

        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        
        const movementStats = [
          { label: 'Total Distance', value: `${data.totalDistance}m` },
          { label: 'Total Movements', value: data.totalMovements },
          { label: 'Average Distance per Movement', value: `${data.averageDistancePerMovement}m` }
        ];

        movementStats.forEach(stat => {
          this.doc.text(`  ${stat.label}: ${stat.value}`, this.margin + 5, this.yPosition);
          this.yPosition += 5;
        });

        this.yPosition += 5;
      });

      this.yPosition += 10;
    } catch (error) {
      console.error('❌ Error in addMovementAnalysis:', error);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('Error generating movement analysis section.', this.margin, this.yPosition);
      this.yPosition += 15;
    }
  }

  // ✅ Add monthly movement data
  addMonthlyMovementData(monthlyMovementData) {
    try {
      console.log('🔍 Adding monthly movement data with:', monthlyMovementData);
      this.addSectionTitle('Monthly Movement Breakdown');
      
      if (!monthlyMovementData || Object.keys(monthlyMovementData).length === 0) {
        console.log('❌ No monthly movement data available');
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text('No monthly movement data available for the selected period.', this.margin, this.yPosition);
        this.yPosition += 15;
        return;
      }
      
      Object.entries(monthlyMovementData).forEach(([month, data]) => {
        // Check if we need a new page for this month
        this.checkPageBreak(40);
        
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`${month}:`, this.margin, this.yPosition);
        this.yPosition += 6;

        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        
        const monthStats = [
          { label: 'Total Distance', value: `${Math.round(data.totalDistance * 100) / 100}m` },
          { label: 'Average Distance', value: `${Math.round(data.averageDistance * 100) / 100}m` },
          { label: 'Total Logs', value: data.totalLogs }
        ];

        monthStats.forEach(stat => {
          this.doc.text(`  ${stat.label}: ${stat.value}`, this.margin + 5, this.yPosition);
          this.yPosition += 5;
        });

        // Individual crane data for this month
        if (data.craneDistances) {
          Object.entries(data.craneDistances).forEach(([craneId, craneData]) => {
            this.doc.text(`    ${craneId}: ${craneData.distance}m`, this.margin + 10, this.yPosition);
            this.yPosition += 4;
          });
        }

        this.yPosition += 5;
      });

      this.yPosition += 10;
    } catch (error) {
      console.error('❌ Error in addMonthlyMovementData:', error);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('Error generating monthly movement data section.', this.margin, this.yPosition);
      this.yPosition += 15;
    }
  }

  // ✅ Add recommendations section
  addRecommendations(data) {
    try {
      console.log('🔍 Adding recommendations with data:', data);
      this.addSectionTitle('Recommendations & Insights');
      
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      
      const recommendations = this.generateRecommendations(data);
      console.log('🔍 Generated recommendations:', recommendations);
      
      recommendations.forEach((rec, index) => {
        // Check if we need a new page for this recommendation
        this.checkPageBreak(10);
        
        this.doc.text(`${index + 1}. ${rec}`, this.margin, this.yPosition);
        this.yPosition += 8;
      });

      this.yPosition += 10;
    } catch (error) {
      console.error('❌ Error in addRecommendations:', error);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('Error generating recommendations section.', this.margin, this.yPosition);
      this.yPosition += 15;
    }
  }

  // ✅ Generate recommendations based on data
  generateRecommendations(data) {
    const recommendations = [];
    const { sessionsData, cumulativeStats, movementAnalysis } = data;
    
    if (sessionsData.length === 0) {
      recommendations.push('No operational data available for the selected period.');
      return recommendations;
    }

    // Working hours analysis
    const totalWorkingHours = cumulativeStats.overall.working;
    const totalMaintenanceHours = cumulativeStats.overall.maintenance;
    
    if (totalWorkingHours > 1000) {
      recommendations.push('High working hours detected - consider additional maintenance scheduling.');
    }
    
    if (totalMaintenanceHours < totalWorkingHours * 0.1) {
      recommendations.push('Maintenance hours are low relative to working hours - increase maintenance frequency.');
    }

    // Movement analysis
    Object.entries(movementAnalysis.byCrane).forEach(([craneId, data]) => {
      if (data.totalDistance > 5000) {
        recommendations.push(`Crane ${craneId} shows high movement - optimize routes for efficiency.`);
      }
      
      if (data.averageDistancePerMovement > 100) {
        recommendations.push(`Crane ${craneId} has long average movements - investigate operational patterns.`);
      }
    });

    // General recommendations
    recommendations.push('Regular GPS tracking analysis recommended for route optimization.');
    recommendations.push('Monitor fuel consumption relative to distance traveled.');
    recommendations.push('Consider implementing predictive maintenance based on usage patterns.');

    return recommendations;
  }

  // ✅ Helper function to calculate total distance
  calculateTotalDistance(movementAnalysis) {
    let totalDistance = 0;
    Object.values(movementAnalysis.byCrane).forEach(craneData => {
      totalDistance += craneData.totalDistance;
    });
    return Math.round(totalDistance * 100) / 100;
  }

  // ✅ Helper function to truncate text
  truncateText(text, maxWidth) {
    if (text.length <= maxWidth) return text;
    return text.substring(0, maxWidth - 3) + '...';
  }

  // ✅ Generate and download comprehensive PDF
  async generatePDF(data) {
    try {
      const { companyName, reportDate, sessionsData, cumulativeStats, movementAnalysis, monthlyMovementData, timePeriods } = data;
      
      console.log('🔍 Starting PDF generation with data:', {
        companyName,
        reportDate,
        sessionsCount: sessionsData?.length,
        hasCumulativeStats: !!cumulativeStats,
        hasMovementAnalysis: !!movementAnalysis,
        hasMonthlyData: !!monthlyMovementData,
        hasTimePeriods: !!timePeriods
      });
      
      this.initDocument(companyName, reportDate);
      console.log('✅ Document initialized');
      
      this.addExecutiveSummary(data);
      console.log('✅ Executive summary added');
      
      // ✅ Add charts section
      await this.addChartsSection();
      console.log('✅ Charts section added');
      
      // ✅ Add sessions table (restore working logic)
      this.addSessionsTable(sessionsData || []);
      console.log('✅ Sessions table added');
      
      this.addCumulativeStatistics(cumulativeStats, timePeriods);
      console.log('✅ Cumulative statistics added');
      
      this.addMovementAnalysis(movementAnalysis);
      console.log('✅ Movement analysis added');
      
      this.addMonthlyMovementData(monthlyMovementData);
      console.log('✅ Monthly movement data added');
      
      // ✅ Recommendations section removed as requested

      // Generate filename
      const filename = `Crane_Analysis_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      console.log('✅ PDF generation complete, saving file:', filename);
      
      // Save PDF
      this.doc.save(filename);
      
      return { success: true, filename };
    } catch (error) {
      console.error('❌ PDF generation error:', error);
      console.error('❌ Error stack:', error.stack);
      return { success: false, error: error.message };
    }
  }

  // ✅ Convert HTML element to image and add to PDF
  async addElementAsImage(element, title) {
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = this.pageWidth - (2 * this.margin);
      // ✅ Increase chart height by 50% for better visibility
      const imgHeight = ((canvas.height * imgWidth) / canvas.width) * 1.5;
      
      // Check if we need a new page
      if (this.yPosition + imgHeight > this.pageHeight - 40) {
        this.doc.addPage();
        this.yPosition = 30;
      }
      
      // ✅ Add chart title
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(title, this.margin, this.yPosition);
      this.yPosition += 8;
      
      this.doc.addImage(imgData, 'PNG', this.margin, this.yPosition, imgWidth, imgHeight);
      this.yPosition += imgHeight + 15;
      
    } catch (error) {
      console.error('❌ Error converting element to image:', error);
    }
  }
}

// ✅ Export default instance
export default new PDFExportService(); 