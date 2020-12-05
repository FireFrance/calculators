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

// This swaps the columns and rows of a grid/matrix of values
function transpose(matrix) {
    return matrix[0].map((x,i) => matrix.map(x => x[i]))
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


const providers = [
    { 
        name:'Bourse Direct',
        calcBrokerFee: bouseDirectPeaBrokerageFee,
        calcWithdrawalFee: () => 6
    },
    {
        name: 'Boursorama',
        calcBrokerFee: boursoramaPeaBrokerageFee,
        calcWithdrawalFee: () => 0
    },
    {
        name: 'Saxo',
        calcBrokerFee: saxoBankPeaBrokerageFee,
        calcWithdrawalFee: () => 0
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

function calculateMonthsOfContributionLeftInYear(accountLimit, totalContribution, monthlyContribution) {
    if (accountLimit) {
        const contributionLeftAtStartOfYear = accountLimit - totalContribution
        const monthsLeft = Math.floor(contributionLeftAtStartOfYear / monthlyContribution)

        if (monthsLeft > MONTHS_PER_YEAR) {
            return MONTHS_PER_YEAR
        }
        if (monthsLeft < 0) {
            return 0
        }

        return monthsLeft
    }

    return MONTHS_PER_YEAR
}

function getAccumlationGraphData(expectedYearlyGrowthRate, startingValue, monthlyContribution, numberOfYears, expenseRatio, limit) {
    // First column is the year, starting at 0, then we have one per provider
    const header = ['Year', "Cash contribution", ...providers.map(({name}) => name)]

    // First row, year 0 all providers start at the startingValue
    const rows = [[0, 0, ...providers.map(() => startingValue)]]

    // Iterate through each year calculating the amount that each account will contain
    // Store and use the values for each provider from the previous year, so 
    // we can calculate a management fee if needed in future
    const lastYearValues = {}
    let totalContribution = 0
    const cashEquivalent = [startingValue]
    for (let i = 1; i <= numberOfYears; i++) {
            // If the account has a contribution limit, like a PEA, figure out if we're going to hit this 
            // within the year and if so how many months we can continue to contribute
            const monthsLeftInYearToContribute = calculateMonthsOfContributionLeftInYear(limit, totalContribution, monthlyContribution)
            totalContribution += (monthlyContribution * monthsLeftInYearToContribute)

        for (const { name, calcBrokerFee } of providers) {
            // The brokerage fee is taken out of the monthly contribution before we invest
            const brokerFee = calcBrokerFee(monthlyContribution)
            const contributionAfterBrokerFee = monthlyContribution - brokerFee

            const lastYearValueForThisProvider = lastYearValues[name] || startingValue

            // Calculate future value including compounding + brokerage fees. Negation is needed
            // because standard FV uses positive values for debts and negative for growth
            const valueAfterContributioningMonths = -FV(
                expectedYearlyGrowthRate / MONTHS_PER_YEAR,
                monthsLeftInYearToContribute,
                contributionAfterBrokerFee,
                lastYearValueForThisProvider,
                1
            )

            // Additional compounding during months of the year after which you've maxed
            // out the contributions and can't pay anything in.
            const nonContributingMonths = MONTHS_PER_YEAR - monthsLeftInYearToContribute
            const newValue = -FV(
                expectedYearlyGrowthRate / MONTHS_PER_YEAR,
                nonContributingMonths,
                0,
                valueAfterContributioningMonths,
                1
            )

            // Each year, we apply the fund expense ratio to the total amount that was in 
            // the portfolio at the end of the year.
            const fundFees = (expenseRatio / 100) * newValue
            const endOfYearValue = newValue - fundFees

            // Now we don't need last year's value so we overwrite it with
            // what we just calculated, ready for the following year
            lastYearValues[name] = endOfYearValue
        }

        const row = [i, totalContribution, ...providers.map(({name}) => lastYearValues[name])] 
        rows.push(row)
    }
    return [header, ...rows]
}

function calculateWithdrawalAmount(totalContribution, totalPortfolioAmount, withdrawalRatePercent, provider) {
    const { calcBrokerFee, calcWithdrawalFee } = provider

    const grossMonthly = (totalPortfolioAmount * (withdrawalRatePercent / 100)) / MONTHS_PER_YEAR
    const afterBrokerageFees = grossMonthly - calcBrokerFee(grossMonthly)
    const afterWithdrawalFees = afterBrokerageFees - calcWithdrawalFee(afterBrokerageFees)

    const proportionOfGains =  1 - (totalContribution / totalPortfolioAmount)
    const taxableAmount = proportionOfGains * afterWithdrawalFees
    const totalTax = taxableAmount * (17.2 / 100)
    const afterTax = afterWithdrawalFees - totalTax

    return [grossMonthly, afterBrokerageFees, afterWithdrawalFees, afterTax]
}


function getWithdrawalAmounts(expectedYearlyGrowthRate, startingValue, monthlyContribution, numberOfYears, withdrawalRatePercent, expenseRatio, limit) {
    const accumulationData = getAccumlationGraphData(expectedYearlyGrowthRate, startingValue, monthlyContribution, numberOfYears, expenseRatio, limit)

    const finalValues = accumulationData[accumulationData.length - 1]
    const [, totalContribution, ...totalPortfolioAmounts] = finalValues

    const header = ['', ...providers.map(({name}) => name)]

    const valueTitles = [
        `Gross Monthly at ${withdrawalRatePercent}%`, 
        'After brokerage fees',
        'After withdrawal fees',
        'Final after 17.2% tax on gains proportion'
    ]

    const providerValues = [valueTitles]
    let providerNumber = 0
    for (const provider of providers) {
        values = calculateWithdrawalAmount(totalContribution, totalPortfolioAmounts[providerNumber], withdrawalRatePercent, provider)
        providerValues.push(values)
        providerNumber++
    }

    return [
        header,
        [ 'Initial Portfolio Total', ...totalPortfolioAmounts], 
        ...transpose(providerValues)
    ]
}



//console.info(getFeeGraphData())


//  console.info(getAccumlationGraphData(0.07, 0, 1000, 15, 150000))
console.info(getWithdrawalAmounts(0.07, 0, 833, 15, 4, 150000))