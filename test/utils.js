const axios = require('axios')
const BigNumber = require('bignumber.js')

const server = 'http://localhost:3000'

const validateValues = (test, ideal) => {
    let result = 0
    let temp = 0

    if (ideal.length === test.length) {
        ideal.forEach(function(element) {
            if (element == test[temp]) {
                result++
            }
            temp++
        }, this)
    }
    return result
}

const tableEqual = (tmp, ideal, onlyFalse = false) =>
    ideal.reduce((acc, key, index) => {
        return onlyFalse && ideal[index] == tmp[index]
            ? acc
            : [...acc, `${index} :: ${ideal[index]} | ${tmp[index]} | ${ideal[index] == tmp[index]}`]
    }, [])

const time = date => parseInt(date.getTime() / 1000)

const getBtcAddress = async ethAddress => {
    const req = await axios.get(`${server}/getbtcaddress/${ethAddress}`).then(response => response)
    if (req.data.success) {
        return req.data.address
    }
    return req.error
}

const checkPayments = async () => {
    const req = await axios.post(`${server}/checkpayments`).then(response => response)
    if (req.data.success) {
        return req.data.success
    }
    return req.error
}
const getBtcPrice = id => {
    return axios.get(`https://api.coinmarketcap.com/v1/ticker/${id}`).then(response => {
        return new BigNumber(1).div(response.data[0]['price_btc'])
    })
}

const totalSold = async () => {
    const req = await axios
        .get(`${server}/totalsold`)
        .then(response => response)
        .catch(err => console.log('err', err))
    console.log(JSON.stringify(req))
    if (req.data.success) {
        return req.data.success
    }
    return req.error
}

const createTx = async (invoker, method, params, isVisualize = true) => {
    const txReceipt = await invoker[method](...params)
    const { tx, logs } = txReceipt
    if (isVisualize) {
        console.log(
            syntaxHighlight(
                {
                    method,
                    params,
                    tx,
                    logs:
                        logs &&
                        logs.length &&
                        logs.map(({ event, args }) => ({
                            event,
                            args,
                        })),
                },
                null,
                2,
            ),
        )
    }
    return txReceipt
}

function syntaxHighlight(json) {
    if (typeof json !== 'string') {
        json = JSON.stringify(json, undefined, 2)
    }
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        function(match) {
            let cls = '\x1b[36m'
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = '\x1b[34m'
                } else {
                    cls = '\x1b[32m'
                }
            } else if (/true|false/.test(match)) {
                cls = '\x1b[35m'
            } else if (/null/.test(match)) {
                cls = '\x1b[31m'
            }
            return cls + match + '\x1b[0m'
        },
    )
}

module.exports = {
    validateValues,
    tableEqual,
    time,
    getBtcAddress,
    checkPayments,
    getBtcPrice,
    totalSold,
    createTx,
}
