const Token = artifacts.require('./UHCToken.sol')
const Receiver = artifacts.require('./EtherReceiver.sol')
const utils = require('./utils')

const BigNumber = require('bignumber.js')
const web3 = Token.web3

//TokenSettings
const name = 'UHC-Token'
const symbol = 'UHC'
const decimals = 4
const totalSupply = 936000000 * 10 ** decimals
const transferFeePercent = 3
const transferReferFeePercent = 1

//ReceiverSetting
const startTime = utils.time(new Date())
const fakeStartTime = utils.time(new Date()) - 100000
const weiPerMinToken = 405188826977925
const softCap = 26000000 * 10 ** decimals
const durationOfStatusSell = 3 * 30 * 24 * 60 * 60;//3 months
const statusMinBorders = [24999, 99999, 349999, 1299999]
const referalBonus = 5
const refererBonus = 5


const initTokens = 27000000 * 10 ** decimals

const addictAccountCount = 6

const sendValueWei = 100 * 10 ** 18
const sendTokenValue = 1000000 * 10 ** decimals

const initAccounts = async initAcc => {
    let tmp = []
    const ethAddresses = []
    for (let i = 0; i < addictAccountCount + 1; i++) {
        let newAcc = await web3.personal.newAccount('')
        ethAddresses.push(newAcc)
        tmp.push(
            await web3.eth.sendTransaction({
                from: initAcc,
                to: newAcc,
                value: sendValueWei,
            }),
        )
    }
    await new Promise((res, rej) => {
        let waitFunc = async () => {
            try {
                let i = 0
                for (let item of tmp) {
                    const txInfo = await web3.eth.getTransaction(item)
                    if (!txInfo) {
                        setTimeout(waitFunc, 30)
                    }
                    i++
                }
                return res()
            } catch (e) {
                setTimeout(waitFunc, 30)
            }
        }
        waitFunc()
    })
    return ethAddresses
}

const initToken = async address => {
    await web3.personal.unlockAccount(address, '')
    return Token.new(name, symbol, decimals, totalSupply, transferFeePercent, transferReferFeePercent, { from: address })
}

const initReceiver = async (tokenInstance, address) => {
    await web3.personal.unlockAccount(address, '')
    return Receiver.new(tokenInstance.address, startTime, weiPerMinToken, softCap, durationOfStatusSell, statusMinBorders, referalBonus, refererBonus, true, {
        from: address,
    })
}
//Для проверки ресивера, который закончился
const initFinishedReceiver = async (tokenInstance, address, isWithdraw = true) => {
    await web3.personal.unlockAccount(address, '')
    return Receiver.new(tokenInstance.address, fakeStartTime, weiPerMinToken, isWithdraw ? softCap : 0, durationOfStatusSell, statusMinBorders, referalBonus, refererBonus, false, {
        from: address,
    })
}

const distributeTokens = async (token, owner, addresses) => {
    const res = []
    for (let i = 0; i < addresses.length; i++) {
        if (addresses[i] === owner) {
            continue
        }
        res.push(
            (await token.transfer(addresses[i], sendTokenValue, { from: owner }))['logs'][0]['args'][
                '_value'
            ].valueOf(),
        )
    }
    return res
}

const distributeTokensToReceiver = async (token, receiverAddress, owner) => {
    return (await token.transfer(receiverAddress, softCap * 1.1, { from: owner }))['logs'][0]['args']['_value'].valueOf()
}

const tokenSetting = {
    name,
    symbol,
    decimals,
    totalSupply,
    transferFeePercent,
    transferReferFeePercent,
    sendValueWei,
    sendTokenValue,
}

const receiverSetting = {
    startTime,
    fakeStartTime,
    weiPerMinToken,
    softCap,
    durationOfStatusSell,
    statusMinBorders,
    referalBonus,
    refererBonus,
    balance: softCap * 1.1,
}

module.exports = {
    initAccounts,
    initToken,
    initReceiver,
    initFinishedReceiver,
    distributeTokens,
    distributeTokensToReceiver,
    tokenSetting,
    receiverSetting,
}
