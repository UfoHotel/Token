const init = require('./init')
const utils = require('./utils')
const BigNumber = require('bignumber.js')

const MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
const ethAddresses = []
const tokenSetting = init.tokenSetting
const receiverSetting = init.receiverSetting
const giftPercent = 5
let tokenInstance
let receiverInstance

contract('Receiver', accounts => {
    it('Stage 1', async () => {
        //1. Generate accounts
        ethAddresses.push(...(await init.initAccounts(accounts[0])))

        const tmp = []
        const ideal = [
            tokenSetting.totalSupply,
            tokenSetting.decimals,
            tokenSetting.name,
            tokenSetting.symbol,
            ethAddresses[0],
            tokenSetting.transferFeePercent,
            true,
        ]
        //2. Create token instance
        tokenInstance = await init.initToken(ethAddresses[0])

        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.decimals()).valueOf())
        tmp.push((await tokenInstance.name()).valueOf())
        tmp.push((await tokenInstance.symbol()).valueOf())
        tmp.push((await tokenInstance.owner()).valueOf())
        tmp.push((await tokenInstance.transferFeePercent()).valueOf())
        //3. Activate platform fee
        await web3.personal.unlockAccount(ethAddresses[0], '')
        await tokenInstance.serviceOnTransferFee({ from: ethAddresses[0] })

        tmp.push((await tokenInstance.isTransferFee()).valueOf())

        let result = utils.validateValues(tmp, ideal)

        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('Stage 2', async () => {
        const tmp = []
        const ideal = []
        //1. Create receiver instance
        receiverInstance = await init.initReceiver(tokenInstance, ethAddresses[0], false)
        assert.ok(receiverInstance)
        //2. Set receiver backend group in token
        await web3.personal.unlockAccount(ethAddresses[0], '')
        tmp.push(
            (await tokenInstance.serviceGroupChange(receiverInstance.address, 3, {
                from: ethAddresses[0],
            }))['logs'][0]['args']['_newgroup'].valueOf(),
        )
        ideal.push(3)
        tmp.push((await receiverInstance.getGroup.call(ethAddresses[0])).valueOf())
        ideal.push(4)
        //3. Move tokens to receiver
        tmp.push(await init.distributeTokensToReceiver(tokenInstance, receiverInstance.address, ethAddresses[0]))
        ideal.push(init.receiverSetting.balance)
        //4. Activate contract
        await web3.personal.unlockAccount(ethAddresses[0], '')
        tmp.push(
            (await receiverInstance.activateVersion(true, {
                from: ethAddresses[0],
            }))['logs'][0]['args']['_isActivate'].valueOf(),
        )
        ideal.push(true)
        // 5. Close bulk import
        await utils.createTx(receiverInstance, 'finishBulkImport', [{ from: ethAddresses[0] }])

        let result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('Stage 3 (Transfer token to investor::no gift)', async () => {
        const tmp = []
        const ideal = []
        const amount = [1000 * 10 ** 4, 10000 * 10 ** 4, 25000 * 10 ** 4, 50000 * 10 ** 4]
        for (let i = 1; i < 5; i++) {
            await web3.personal.unlockAccount(ethAddresses[0], '')
            console.log('1', tmp)
            const transferReceiver = await receiverInstance.transfer(ethAddresses[i], amount[i - 1], {
                from: ethAddresses[0],
            })
            console.log('2', tmp)
            tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[i])).valueOf()))
            console.log('3', tmp)
            ideal.push(amount[i - 1])
        }

        let result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    /*
    it('Stage 4 (Buying token by investor::(no gift && no promo))', async () => {
        const tmp = []
        const ideal = []
        const amount = [0.4, 0.6, 0.8, 1]
        for (let i = 1; i < 5; i++) {
            await web3.personal.unlockAccount(ethAddresses[i], '')
            const weiAmount = web3.toWei(amount[i - 1], 'ether')
            const buying = await receiverInstance.sendTransaction({
                from: ethAddresses[i],
                value: weiAmount,
            })
            tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[i])).valueOf()))
            ideal.push((await receiverInstance.calculateTokenCount(weiAmount)).valueOf())
        }

        let result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    */
    it('Stage 5 (Buying tokens with promo for i === 2)', async () => {
        const tmp = []
        const ideal = []
        const amount = 0.2
        //1. Create referal code
        //2. Buying with referal code
    })
})
