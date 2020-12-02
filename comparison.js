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

function saxoBankPeaBrokerageFee(tradeAmount) {
    if (tradeAmount <= 1000) {
        return Math.min(2.5, (tradeAmount * 0.005))
    }
    if (tradeAmount <= 5000) {
        return 5
    }
    if (tradeAmount <= 7500) {
        return 7.5
    }
    if (tradeAmount <= 10000) {
        return 10
    }

    // Above 10k
    return tradeAmount * 0.001
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
    },
    {
        name: 'Saxo',
        calcBrokerFee: saxoBankPeaBrokerageFee,
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

function getAccumlationGraphData(expectedYearlyGrowthRate, startingValue, monthlyContribution, numberOfYears, limit) {
    // First column is the year, starting at 0, then we have one per provider
    const header = ['Year', ...providers.map(({name}) => name), "Cash contribution"]

    // First row, year 0 all providers start at the startingValue
    const rows = [[0, ...providers.map(() => startingValue), 0]]

    // Iterate through each year calculating the amount that each account will contain
    // Store and use the values for each provider from the previous year, so 
    // we can calculate a management fee if needed in future
    const lastYearValues = {}
    let totalContribution = 0
    const cashEquivalent = [startingValue]
    for (let i = 1; i <= numberOfYears; i++) {
        for (const { name, calcBrokerFee, calcFundFees } of providers) {

            // The brokerage fee is taken out of the monthly contribution before we invest
            const brokerFee = calcBrokerFee(monthlyContribution)
            const contributionAfterBrokerFee = monthlyContribution - brokerFee

            // const canKeepContributing = totalContribution + monthlyContribution < limit

            // const contributionAfterLimit = canKeepContributing
            //     ? contributionAfterBrokerFee
            //     : 0

            // if (canKeepContributing) {
            //     totalContribution += monthlyContribution * 12
            //     // cashEquivalent.push(totalContribution)
            // }

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

        const row = [i, ...providers.map(({name}) => lastYearValues[name]), totalContribution] 
        rows.push(row)
    }
    return [header, ...rows]
}


   

console.info(getAccumlationGraphData(0.07, 0, 833, 15, 15000))