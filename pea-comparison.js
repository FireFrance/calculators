const MONTHS_PER_YEAR = 12

// General utility functions, not specific to purpose of this script

function FV(rate, numberOfPayments, paymentAmount, principalValue, type) {
    // General future value function - same as in Excel etc
    const pow = Math.pow(1 + rate, numberOfPayments)
   
    const futureValue = rate
        ? (paymentAmount*(1+rate*type)*(1-pow)/rate)-principalValue*pow
        : -1 * (principalValue + paymentAmount * numberOfPayments);

    return futureValue.toFixed(2);
}

// Quick and rough CSV builder from two arrays, print output into a CSV file
// and open directly in Excel to build graphs etc
function buildCsv(header, rows) {
    const allData = [header, ...rows]
    return allData
        .map(line => line.join(','))
        .join('\n') 
}

function isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  function formatForDisplay(value) {
    if (isNumber(value)) {
        return value.toFixed(2)
    }
    return value
}

function buildHtml(header, rows) {
    const allData = [header, ...rows]
    const htmlRows = allData.map(line => {
        const row = line.map(col => `<td>${formatForDisplay(col)}</td>`).join('')
        return `<tr>${row}</tr>`
    })
    return htmlRows.join('\n')
}


function bouseDirectPeaBrokerageFee(tradeAmount) {
    const halfAPercent = 0.005
    if (tradeAmount <= 198) {
        return tradeAmount * halfAPercent
    }
    if (tradeAmount <= 500) {
        return 0.99
    }
    if (tradeAmount <= 1000) {
        return 1.9
    }
    if (tradeAmount <= 2000) {
        return 2.9
    }
    if (tradeAmount <= 4400) {
        return 3.8
    }

    // Above 4400
    return tradeAmount * 0.0009
}

function boursoramaPeaBrokerageFee(tradeAmount) {
    const halfAPercent = 0.005
    if (tradeAmount <= 398 || tradeAmount > 500) {
        return tradeAmount * halfAPercent
    }

    return 1.99
}


function calculateFees(maxAmount, feeFunction) {
    const points = []
    for (let i = 0; i <= maxAmount; i++) {
        points.push(feeFunction(i))
    }
    return points
}

function getAllFees(maxAmount, feeFunctions) {
    const fees = []
    for (let i = 0; i <= maxAmount; i++) {
        fees.push([i, ...feeFunctions.map(feeFunction => feeFunction(i))])
    }
    return fees
}

function amundiMsciWorldFee(totalPortfolioAmount) {
    return totalPortfolioAmount * 0.0038
}

const providers = [
    { 
        name:'Bourse Direct',
        calcBrokerFee: bouseDirectPeaBrokerageFee,
        calcFundFees: amundiMsciWorldFee
    },
    {
        name: 'Boursorama',
        calcBrokerFee: boursoramaPeaBrokerageFee,
        calcFundFees: amundiMsciWorldFee
    }
    // Add more here to include in comparison
]

function getFeeGraphData() {
    const maxAmount = 10000

    const header = ['Amount', ...providers.map(({name}) => name)]
    const fees = getAllFees(maxAmount, providers.map(({calcBrokerFee}) => calcBrokerFee))

    const csvData = buildCsv(header, fees)
    return csvData
}

function getAccumlationGraphData() {
    const expectedYearlyGrowthRate = 0.07
    const startingValue = 0
    const monthlyContribution = 833
    const numberOfYears = 15

    // First column is the year, starting at 0, then we have one per provider
    const header = ['Year', ...providers.map(({name}) => name)]

    // First row, year 0 all providers start at the startingValue
    const rows = [[0, ...providers.map(() => startingValue)]]

    // Iterate through each year calculating the amount that each account will contain
    // Store and use the values for each provider from the previous year, so 
    // we can calculate a management fee if needed in future
    const lastYearValues = {}
    for (let i = 1; i <= numberOfYears; i++) {
        for (const { name, calcBrokerFee, calcFundFees } of providers) {
            // The brokerage fee is taken out of the monthly contribution before we invest
            const brokerFee = calcBrokerFee(monthlyContribution)
            const contributionAfterBrokerFee = monthlyContribution - brokerFee

            const lastYearValueForThisProvider = lastYearValues[name] || startingValue

            // Calculate future value including compounding + brokerage fees. Negation is needed
            // because standard FV uses positive values for debts and negative for growth
            const newValue = -FV(
                expectedYearlyGrowthRate / MONTHS_PER_YEAR,
                MONTHS_PER_YEAR,
                contributionAfterBrokerFee,
                lastYearValueForThisProvider,
                1
            )

            // Each year, we apply the fund expense ratio to the total amount that was in 
            // the portfolio at the end of the year.
            const fundFees = calcFundFees(newValue)
            const endOfYearValue = newValue - fundFees

            // Now we don't need last year's value so we overwrite it with
            // what we just calculated, ready for the following year
            lastYearValues[name] = endOfYearValue
        }

        const row = [i, ...providers.map(({name}) => lastYearValues[name])] 
        rows.push(row)
    }

    //const csvData = buildCsv(header, rows)
    //return csvData
    const htmlTableData = buildHtml(header, rows)
    return htmlTableData
}



// This will give a comparitive graph of the fees based on various trade amounts
// console.info(getFeeGraphData())

// Example usage of FV function, this is starting with 0, paying 500 a month for a year
//console.info(-FV(0.07/12, 12, 500, 0, 1))

// Comparitive graph of PEA accummulatio
console.info(getAccumlationGraphData())



   

