const BigNumber = require('bignumber.js')
const fs = require('fs')
const utils = require('./utils')
const init = require('./init')
const { exec } = require('child_process')
const bitcoin = require('bitcoin-core')

const pathToDir = '/Users/rumster/Git/ufo/ufo-backend-api'
const ymlPath = pathToDir + '/environment.yml'

const bitClient = new bitcoin({
    network: 'regtest',
    username: 'testUser',
    password: 'testPassword',
})

let MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff

const ethAddresses = []
const btcAddresses = []
const tokenSetting = init.tokenSetting
const receiverSetting = init.receiverSetting
let tokenInstance
let receiverInstance
let serverlessProcess
let weiPrice

const commonPw = ''
const tokenBuyCount = new BigNumber(1000000000)

contract('Umka token', accounts => {
    it('(Init...) Token', async () => {
        ethAddresses.push(...(await init.initAccounts(accounts[0])))

        const tmp = []
        const ideal = [
            tokenSetting.totalSupply,
            tokenSetting.decimals,
            tokenSetting.name,
            tokenSetting.symbol,
            ethAddresses[0],
            tokenSetting.transferFeePercent,
        ]

        tokenInstance = await init.initToken(ethAddresses[0])

        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.decimals()).valueOf())
        tmp.push((await tokenInstance.name()).valueOf())
        tmp.push((await tokenInstance.symbol()).valueOf())
        tmp.push((await tokenInstance.owner()).valueOf())
        tmp.push((await tokenInstance.transferFeePercent()).valueOf())

        await init.distributeTokens(tokenInstance, ethAddresses[0], ethAddresses)

        let result = utils.validateValues(tmp, ideal)

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('(Init...) Receivers', async () => {
        const tmp = []
        const ideal = []

        receiverInstance = await init.initReceiver(tokenInstance, ethAddresses[0])
        assert.ok(receiverInstance)
        fakeReceiverInstance = await init.initFinishedReceiver(tokenInstance, ethAddresses[0], false)
        assert.ok(fakeReceiverInstance)

        tmp.push(
            (await tokenInstance.serviceGroupChange(receiverInstance.address, 3, {
                from: ethAddresses[0],
            }))['logs'][0]['args']['_newgroup'].valueOf(),
        )
        ideal.push(3)
        tmp.push((await receiverInstance.getGroup.call(ethAddresses[0])).valueOf())
        ideal.push(4)

        tmp.push(
            (await tokenInstance.serviceGroupChange(fakeReceiverInstance.address, 3, {
                from: ethAddresses[0],
            }))['logs'][0]['args']['_newgroup'].valueOf(),
        )
        ideal.push(3)
        tmp.push((await fakeReceiverInstance.getGroup.call(ethAddresses[0])).valueOf())
        ideal.push(4)

        tmp.push(await init.distributeTokensToReceiver(tokenInstance, receiverInstance.address, ethAddresses[0]))
        ideal.push(init.receiverSetting.balance)

        let result = utils.validateValues(tmp, ideal)
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('(Serverless..) Update environment file', async () => {
        let oldData = await new Promise(function(resolve, reject) {
            fs.readFile(ymlPath, 'utf8', function(err, data) {
                if (err) reject(err)
                else resolve(data)
            })
        })
        let envArray = oldData.split(/\n/g)
        envArray[3] = envArray[3].slice(0, envArray[3].indexOf(':') + 1) + ` "${ethAddresses[0]}"`
        envArray[4] = envArray[4].slice(0, envArray[4].indexOf(':') + 1) + ` "${receiverInstance.address}"`
        envArray[5] = envArray[5].slice(0, envArray[5].indexOf(':') + 1) + ` "${tokenInstance.address}"`
        let newData = envArray.join('\n')
        await new Promise((resolve, reject) => {
            fs.writeFile(ymlPath, newData, 'utf8', (err, data) => {
                if (err) reject(err)
                else resolve(data)
            })
        })

        await new Promise(resolve => setTimeout(resolve, 10000))
        serverlessProcess = exec('serverless offline start', {
            cwd: pathToDir,
        })
        serverlessProcess.stdout.on('data', data => {
            console.log('\x1b[32m%s\x1b[0m', data)
        })

        serverlessProcess.stderr.on('data', data => {
            console.log('\x1b[31m%s\x1b[0m', data)
        })
        await new Promise(resolve => setTimeout(resolve, 10000))
    })

    it(`(Calculate...) btc price in eth`, async () => {
        weiPrice = (await utils.getBtcPrice('ethereum')).multipliedBy(new BigNumber(10 ** 18))
        console.log(`Wei price: ${weiPrice.toNumber()}`)
    })

    it('(Create...) buyers address in serverless db', async () => {
        let tmp = []
        for (let address of ethAddresses) {
            tmp.push(await utils.getBtcAddress(address))
            btcAddresses.push(tmp[tmp.length - 1])
        }
        console.log(btcAddresses)
    })

    it(`(Create...) BTC txs`, async () => {
        let tmp = []
        let amount = tokenBuyCount.multipliedBy(receiverSetting.weiPerMinToken).div(weiPrice)
        console.log(amount.toFixed(8, 0))
        for (let i = 0; i < btcAddresses.length; i++) {
            tmp.push(await bitClient.sendToAddress(btcAddresses[i], amount.toFixed(8, 0)))
            await bitClient.generate(5)
        }

        await new Promise((res, rej) => {
            let waitFunc = async () => {
                try {
                    let i = 0
                    for (let item of tmp) {
                        const txInfo = await bitClient.getTransaction(item)
                        if (!txInfo) {
                            setTimeout(waitFunc, 30)
                        }
                        console.log(txInfo.txid + ' ' + i)
                        i++
                    }
                    return res()
                } catch (e) {
                    setTimeout(waitFunc, 30)
                }
            }
            waitFunc()
        })
    })
    it('(Prove...) (Only eth bonuses) Send ether to receiver', async () => {
        const stage1 = []
        const stage2 = []
        const svalue = 10
        for (let i = 0; i < ethAddresses.length; i++) {
            stage1.push(`${ethAddresses[i]} : ${(await tokenInstance.balanceOf(ethAddresses[i])).valueOf()}`)
            await web3.personal.unlockAccount(ethAddresses[i], commonPw)
            await receiverInstance.sendTransaction({
                from: ethAddresses[i],
                value: web3.toWei(svalue * (i + 1), 'ether'),
            })
            stage2.push(`${ethAddresses[i]} : ${(await tokenInstance.balanceOf(ethAddresses[i])).valueOf()}`)
        }
        await utils.checkPayments()
        const stage3 = []

        for (let i = 0; i < ethAddresses.length; i++) {
            stage3.push(`${ethAddresses[i]} : ${(await tokenInstance.balanceOf(ethAddresses[i])).valueOf()}`)
        }
        console.log(`stage 1 : ${JSON.stringify(stage1)}`)
        console.log(`stage 2 : ${JSON.stringify(stage2)}`)
        console.log(`stage 3 : ${JSON.stringify(stage3)}`)
    })

    it('(Prove...) checkReceivering work', async () => {
        let before = []
        let after = []
        console.log(
            `Sell node left before: ${(await tokenInstance.balanceOf(receiverInstance.address, {
                from: ethAddresses[0],
            })).valueOf()}`,
        )
        for (let i = 0; i < ethAddresses.length; i++) {
            before.push(`${ethAddresses[i]} : ${(await tokenInstance.balanceOf(ethAddresses[i])).valueOf()}`)
        }
        before.push(`${ethAddresses[0]} : ${(await tokenInstance.balanceOf(ethAddresses[0])).valueOf()}`)
        utils.checkPayments()
        utils.checkPayments()
        await new Promise(resolve => setTimeout(resolve, 10000))
        console.log(await utils.checkPayments())
        await new Promise(resolve => setTimeout(resolve, 10000))
        for (let i = 0; i < ethAddresses.length; i++) {
            after.push(`${ethAddresses[i]} : ${(await tokenInstance.balanceOf(ethAddresses[i])).valueOf()}`)
        }
        before.push(`${ethAddresses[0]} : ${(await tokenInstance.balanceOf(ethAddresses[0])).valueOf()}`)
        console.log(before)
        console.log(after)
        console.log(
            `Sell node left after: ${(await tokenInstance.balanceOf(receiverInstance.address, {
                from: ethAddresses[0],
            })).valueOf()}`,
        )
    })

    it('Total sold', async () => {
        console.log(await utils.totalSold())
    })

    it('Update wei per token', async () => {
        let tmp = []
    })
    it('Kill serverless process', async () => {
        serverlessProcess.kill()
        const port1 = await exec('lsof -i :3000')
        const port3 = await exec('lsof -i :8500')
        port1.stdout.on('data', async data => {
            console.log('\x1b[34m%s\x1b[0m', data)
            if (data) {
                await exec('kill -9 ' + data.split('\n')[1].split(/[\s]+/g)[1])
            }
        })
        port3.stdout.on('data', async data => {
            console.log('\x1b[32m%s\x1b[0m', data)
            if (data) {
                await exec('kill -9 ' + data.split('\n')[1].split(/\s+/g)[1])
            }
        })
        await new Promise(resolve => setTimeout(resolve, 1000))
    })
})
