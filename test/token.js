const init = require('./init')
const utils = require('./utils')
const BigNumber = require('bignumber.js')

const MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
const ethAddresses = []
const tokenSetting = init.tokenSetting
let tokenInstance

contract('UHC token', accounts => {
    it('Init...', async () => {
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

    it('Admin part...', async () => {
        let tmp = []

        await web3.personal.unlockAccount(ethAddresses[0], '')
        tmp.push(
            (await tokenInstance.serviceGroupChange(ethAddresses[1], 4, { from: ethAddresses[0] }))['logs'][0]['args'][
                '_newgroup'
            ].valueOf(),
        )
        tmp.push((await tokenInstance.getGroup.call(ethAddresses[1])).valueOf())
        await web3.personal.unlockAccount(ethAddresses[1], '')
        tmp.push(
            (await tokenInstance.serviceGroupChange(ethAddresses[1], 0, { from: ethAddresses[1] }))['logs'][0]['args'][
                '_newgroup'
            ].valueOf(),
        )
        tmp.push((await tokenInstance.getGroup.call(ethAddresses[1])).valueOf())

        let ideal = [4, 4, 0, 0]
        let result = utils.validateValues(tmp, ideal)

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('Admin part... [not-admin]', async () => {
        let tmp = []

        await web3.personal.unlockAccount(ethAddresses[2], '')
        await tokenInstance.serviceGroupChange(ethAddresses[2], 4, { from: ethAddresses[2] }).catch(err => {
            tmp[0] = true
        })

        await web3.personal.unlockAccount(ethAddresses[1], '')
        await tokenInstance.serviceIncreaseBalance
            .call(ethAddresses[1], 10000, { from: ethAddresses[1] })
            .catch(err => {
                tmp[1] = true
            })

        let ideal = [true, true]
        let result = utils.validateValues(tmp, ideal)

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('Transfer ownership', async () => {
        const tmp = []

        await web3.personal.unlockAccount(ethAddresses[0], '')
        //Curret group
        tmp.push((await tokenInstance.getGroup.call(ethAddresses[1])).valueOf())
        //Set new owner. Now it will be subowner group
        tmp.push(
            (await tokenInstance.serviceTransferOwnership(ethAddresses[1], { from: ethAddresses[0] }))['logs'][0][
                'args'
            ]['_newgroup'].valueOf(),
        )
        //Another test for subowner
        tmp.push((await tokenInstance.getGroup.call(ethAddresses[0])).valueOf())
        //Another test for subowner
        tmp.push((await tokenInstance.getGroup.call(ethAddresses[1])).valueOf())
        await web3.personal.unlockAccount(ethAddresses[1], '')
        //Claim ownership, new group will be owner
        tmp.push(
            (await tokenInstance.serviceClaimOwnership({ from: ethAddresses[1] }))['logs'][0]['args'][
                '_newgroup'
            ].valueOf(),
        )
        //Another test for default
        tmp.push((await tokenInstance.getGroup.call(ethAddresses[0])).valueOf())
        //Another test for owner
        tmp.push((await tokenInstance.getGroup.call(ethAddresses[1])).valueOf())
        //Set old owner. Now it will be subowner group
        tmp.push(
            (await tokenInstance.serviceTransferOwnership(ethAddresses[0], { from: ethAddresses[1] }))['logs'][0][
                'args'
            ]['_newgroup'].valueOf(),
        )
        tmp.push(
            (await tokenInstance.serviceClaimOwnership({ from: ethAddresses[0] }))['logs'][0]['args'][
                '_newgroup'
            ].valueOf(),
        )
        //Another test for default
        tmp.push((await tokenInstance.getGroup.call(ethAddresses[0])).valueOf())
        //Another test for owner
        tmp.push((await tokenInstance.getGroup.call(ethAddresses[1])).valueOf())

        let ideal = [tmp[0], 2, 2, 2, 9, 0, 9, 2, 9, 9, 0]
        let result = utils.validateValues(tmp, ideal)
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('Transfer ownership [stress-test]', async () => {
        const tmp = []

        await web3.personal.unlockAccount(ethAddresses[1], '')
        await tokenInstance.serviceTransferOwnership(ethAddresses[2], { from: ethAddresses[1] }).catch(err => {
            tmp[0] = true
        })

        await tokenInstance.serviceClaimOwnership({ from: ethAddresses[1] }).catch(err => {
            tmp[1] = true
        })

        let ideal = [true, true]
        let result = utils.validateValues(tmp, ideal)

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('(Transfer..) Token', async () => {
        const tmp = []
        const svalue = 1000 * 10 ** tokenSetting.decimals
        await web3.personal.unlockAccount(ethAddresses[1], '')
        tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[0])).valueOf()))
        tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[1])).valueOf()))
        tmp.push((await tokenInstance.transferFeePercent()).valueOf())
        tmp.push(
            (await tokenInstance.transfer(ethAddresses[1], svalue, { from: ethAddresses[0] }))['logs'][0]['args'][
                '_value'
            ],
        )
        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push(
            (await tokenInstance.transfer(ethAddresses[0], svalue / 2, { from: ethAddresses[1] }))['logs'][1]['args'][
                '_value'
            ],
        )
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())

        let ideal = [
            tmp[0],
            tmp[1],
            tokenSetting.transferFeePercent,
            svalue,
            tmp[0] - svalue,
            tmp[1] + svalue,
            svalue / 2,
            tmp[1] + svalue / 2 * (1 - tmp[2] / 100),
        ]
        let result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('(Approve & TransferFrom...) Token', async () => {
        let tmp = []
        let value = 1000 * 10 ** tokenSetting.decimals
        let subvalue = 500 * 10 ** tokenSetting.decimals

        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.transferFeePercent()).valueOf())
        await web3.personal.unlockAccount(ethAddresses[1], '')
        tmp.push(
            (await tokenInstance.approve(ethAddresses[1], 0, value, { from: ethAddresses[0] }))['logs'][0]['args'][
                '_value'
            ],
        )
        tmp.push((await tokenInstance.allowance(ethAddresses[0], ethAddresses[1])).valueOf())
        tmp.push(
            (await tokenInstance.transferFrom(ethAddresses[0], ethAddresses[1], subvalue, { from: ethAddresses[1] }))[
                'logs'
            ][1]['args']['_value'],
        )
        tmp.push((await tokenInstance.allowance.call(ethAddresses[0], ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())

        let ideal = [
            tmp[0],
            tmp[1],
            tmp[2],
            value,
            value,
            subvalue,
            value - subvalue * (1 + tmp[2] / 100),
            tmp[0] - subvalue,
            new BigNumber(tmp[1]).plus(subvalue),
        ]
        let result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('[stress-test] Token', async () => {
        let tmp = []
        let svalue = 1000 * 10 ** tokenSetting.decimals

        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        //Overflow
        await tokenInstance
            .approve(ethAddresses[1], await tokenInstance.allowance(ethAddresses[0], ethAddresses[1]), MAX_UINT256, {
                from: ethAddresses[1],
            })
            .catch(err => {
                tmp.push(true)
            })

        //Empty balances + approve (= allowance > balance)
        await tokenInstance
            .transferFrom(ethAddresses[1], ethAddresses[0], svalue, { from: ethAddresses[1] })
            .catch(err => {
                tmp.push(true)
            })

        await tokenInstance
            .transferFrom(ethAddresses[0], ethAddresses[2], MAX_UINT256, { from: ethAddresses[1] })
            .catch(err => {
                tmp.push(true)
            })

        await tokenInstance.approve(
            ethAddresses[1],
            await tokenInstance.allowance(ethAddresses[0], ethAddresses[1]),
            svalue * (1 + tokenSetting.transferFeePercent / 100),
            {
                from: ethAddresses[0],
            },
        )

        tmp.push((await tokenInstance.allowance(ethAddresses[0], ethAddresses[1])).valueOf())

        tmp.push(
            (await tokenInstance.transferFrom(ethAddresses[0], ethAddresses[1], svalue, { from: ethAddresses[1] }))[
                'logs'
            ][1]['args']['_value'],
        )
        tmp.push((await tokenInstance.allowance(ethAddresses[0], ethAddresses[1])).valueOf())

        let ideal = [tmp[0], true, true, true, svalue * (1 + tokenSetting.transferFeePercent / 100), svalue, 0]
        let result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('(Prove...) pause', async () => {
        const tmp = []
        const value = 1000 * 10 ** tokenSetting.decimals
        const subvalue = 500 * 10 ** tokenSetting.decimalsconst
        //Stop contract
        await tokenInstance.servicePause({ from: ethAddresses[0] })

        await web3.personal.unlockAccount(ethAddresses[1], '')

        await tokenInstance.approve(ethAddresses[2], 0, value, { from: ethAddresses[1] }).catch(e => {
            tmp.push(true)
        })
        await tokenInstance
            .transferFrom(ethAddresses[2], ethAddresses[3], subvalue, { from: ethAddresses[1] })
            .catch(e => {
                tmp.push(true)
            })
        await tokenInstance.transfer(ethAddresses[2], subvalue, { from: ethAddresses[1] }).catch(e => {
            tmp.push(true)
        })
        await tokenInstance.serviceUnpause({ from: ethAddresses[0] })
        await tokenInstance.serviceUnpause({ from: ethAddresses[0] }).catch(e => {
            tmp.push(true)
        })
        const ideal = [true, true, true, true]
        const result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('(Prove...) total supply changing', async () => {
        const tmp = []
        const svalue = 100 * 10 ** tokenSetting.decimals
        await web3.personal.unlockAccount(ethAddresses[0], '')
        tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[1])).valueOf()))
        tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[2])).valueOf()))
        tmp.push(parseInt((await tokenInstance.totalSupply()).valueOf()))

        //increase
        tmp.push(
            (await tokenInstance.serviceIncreaseBalance(ethAddresses[1], svalue, { from: ethAddresses[0] }))['logs'][0][
                'args'
            ]['_value'],
        )
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.totalSupply()).valueOf())

        //decrease
        tmp.push(
            (await tokenInstance.serviceDecreaseBalance(ethAddresses[1], svalue, { from: ethAddresses[0] }))['logs'][0][
                'args'
            ]['_value'],
        )
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.totalSupply()).valueOf())

        //burn
        tmp.push(
            (await tokenInstance.serviceTokensBurn(ethAddresses[1], { from: ethAddresses[0] }))['logs'][0]['args'][
                '_value'
            ],
        )
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.totalSupply()).valueOf())

        //increase burned
        tmp.push(
            (await tokenInstance.serviceIncreaseBalance(ethAddresses[1], tmp[0], { from: ethAddresses[0] }))['logs'][0][
                'args'
            ]['_value'],
        )
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.totalSupply()).valueOf())

        //redirect
        tmp.push(
            (await tokenInstance.serviceRedirect(ethAddresses[1], ethAddresses[2], svalue, { from: ethAddresses[0] }))[
                'logs'
            ][0]['args']['_value'],
        )
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.balanceOf(ethAddresses[2])).valueOf())

        //redirect reverse
        tmp.push(
            (await tokenInstance.serviceRedirect(ethAddresses[2], ethAddresses[1], svalue, { from: ethAddresses[0] }))[
                'logs'
            ][0]['args']['_value'],
        )
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.balanceOf(ethAddresses[2])).valueOf())

        const ideal = [
            tmp[0],
            tmp[1],
            tmp[2],
            //increase
            svalue,
            tmp[0] + svalue,
            tmp[2] + svalue,
            //decrease
            svalue,
            tmp[0],
            tmp[2],
            //burn
            tmp[0],
            0,
            tmp[2] - tmp[0],
            //increase burned
            tmp[0],
            tmp[0],
            tmp[2],
            //redirect
            svalue,
            tmp[0] - svalue,
            tmp[1] + svalue,
            //reverse redirect
            svalue,
            tmp[0],
            tmp[1],
        ]
        console.log(utils.tableEqual(tmp,ideal,false))
        let result = utils.validateValues(tmp, ideal)
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('Migration', async () => {
        const tmp = []
        //Activate migration
        await tokenInstance.settingsSwitchState({ from: ethAddresses[0] })
        tmp.push(await tokenInstance.contractEnable())
        if (tmp[0]) {
            console.log('fatal error')
            return
        }
        const startOwnerBalance = await tokenInstance.balanceOf('0x0', { from: ethAddresses[0] })
        let sum = 0
        const holders = []
        const holderLength = (await
                tokenInstance.getHoldersLength()
        ).valueOf()
        console.log(holderLength)
        for (let i = 0; i < holderLength; i++) {
            const address = (await
                    tokenInstance.getHolderLink(i === 0 ? "0x0" : holders[i - 1].address)
            )
                [2]
            holders.push({
                address: address,
                balance: (await tokenInstance.balanceOf(address)).valueOf()
            })
        }

        for (let i = 0; i < holderLength; i++) {
            if(holders[i].address === ethAddresses[0]){
                continue
            }
            await web3.personal.unlockAccount(holders[i].address, '')
            const inc = parseInt(
                (await tokenInstance.userMigration('123', {from: holders[i].address}))['logs'][0]['args']['_balance'],
            )
            sum += inc
        }

        const endOwnerBalance = await tokenInstance.balanceOf('0x0', { from: ethAddresses[0] })
        const ideal = [false, startOwnerBalance.add(sum).toString()]
        tmp.push(endOwnerBalance.toString())

        console.log(utils.tableEqual(tmp,ideal,false))
        let result = utils.validateValues(tmp, ideal)
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
})
