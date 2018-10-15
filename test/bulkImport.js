const init = require('./init')
const utils = require('./utils')
const BigNumber = require('bignumber.js')

const MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
const ethAddresses = []
const tokenSetting = init.tokenSetting
const receiverSetting = init.receiverSetting
let tokenInstance
let receiverInstance

contract('Receiver', accounts => {
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

        tokenInstance = await utils.createTx(init, 'initToken', [ethAddresses[0]])

        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.decimals()).valueOf())
        tmp.push((await tokenInstance.name()).valueOf())
        tmp.push((await tokenInstance.symbol()).valueOf())
        tmp.push((await tokenInstance.owner()).valueOf())
        tmp.push((await tokenInstance.transferFeePercent()).valueOf())

        let result = utils.validateValues(tmp, ideal)

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('(Init...) Receivers', async () => {
        const tmp = []
        const ideal = []
        //Create diactive receiver
        receiverInstance = await init.initReceiver(tokenInstance, ethAddresses[0], false)
        assert.ok(receiverInstance)

        tmp.push(
            (await tokenInstance.serviceGroupChange(receiverInstance.address, 3, {
                from: ethAddresses[0],
            }))['logs'][0]['args']['_newgroup'].valueOf(),
        )
        ideal.push(3)
        tmp.push((await receiverInstance.getGroup.call(ethAddresses[0])).valueOf())
        ideal.push(4)

        tmp.push(await init.distributeTokensToReceiver(tokenInstance, receiverInstance.address, ethAddresses[0]))
        ideal.push(init.receiverSetting.balance)

        let result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('Bulk import', async () => {
        const tmp = []
        const investors = [ethAddresses[2], ethAddresses[3], ethAddresses[4]]
        const wei = [0.5 * 10 ** 18, 1 * 10 ** 18, 1.5 * 10 ** 18]
        //try if receiver isnot active
        await receiverInstance.bulkImport(investors, wei).catch(e => tmp.push(true))
        //activate receiver
        await web3.personal.unlockAccount(ethAddresses[0], '')
        await utils.createTx(receiverInstance, 'activateVersion', [true, { from: ethAddresses[0] }])
        //try if receiver is active
        await utils.createTx(receiverInstance, 'bulkImport', [
            investors,
            wei,
            { from: ethAddresses[0], value: wei.reduce((acc, item) => acc + item, 0) },
        ])
        for (let i = 0; i < investors.length; i++) {
            tmp.push((await receiverInstance.accounts(investors[i]))[0])
        }
        const ideal = [true, ...wei]

        let result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('(Error...) Bulk import', async () => {
        const tmp = []
        const investors = [ethAddresses[2], ethAddresses[3], ethAddresses[4]]
        const wei = [1 * 10 ** 18, 3 * 10 ** 18, 6 * 10 ** 18]
        //investor length greate then wei length ERROR
        await utils
            .createTx(receiverInstance, 'bulkImport', [
                [...investors, ethAddresses[5]],
                wei,
                { from: ethAddresses[0], value: wei.reduce((acc, item) => acc + item, 0) },
            ])
            .catch(e => tmp.push(true))
        //investor length less then wei length NO ERROR
        await utils.createTx(receiverInstance, 'bulkImport', [
            investors,
            [...wei, 10 * 10 ** 18],
            { from: ethAddresses[0], value: [...wei, 10 * 10 ** 18].reduce((acc, item) => acc + item, 0) },
        ])
        for (let i = 0; i < investors.length; i++) {
            tmp.push((await receiverInstance.accounts(investors[i]))[0])
        }

        const ideal = [true, ...wei]

        let result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('Finish bulk import', async () => {
        const tmp = []
        const investors = [ethAddresses[2], ethAddresses[3], ethAddresses[4]]
        const wei = [7 * 10 ** 18, 8 * 10 ** 18, 9 * 10 ** 18]

        tmp.push(await receiverInstance.isBulkImportEnabled().valueOf())

        await utils.createTx(receiverInstance, 'finishBulkImport', [{ from: ethAddresses[0] }])

        tmp.push(await receiverInstance.isBulkImportEnabled().valueOf())

        await utils
            .createTx(receiverInstance, 'bulkImport', [
                investors,
                wei,
                { from: ethAddresses[0], value: wei.reduce((acc, item) => acc + item, 0) },
            ])
            .catch(e => tmp.push(true))

        const ideal = [true, false, true]

        let result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
})
