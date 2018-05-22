const Token = artifacts.require('./UHCToken.sol')
const BigNumber = require('bignumber.js')
const web3 = Token.web3
const utils = require('./utils')

const MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff

contract('UHC token', accounts => {
    const name = 'UHC-Token'
    const symbol = 'UHC'
    const decimals = 4
    const totalSupply = 936000000 * 10 ** decimals

    let tokenInstance

    const ethAddresses = []
    const addictAccountCount = 6

    const sendValueWei = 100 * 10 ** 18
    const sendTokenValue = 1000000 * 10 ** decimals

    it('(Init...) ethAddresses', async () => {
        let tmp = []
        for (let i = 0; i < addictAccountCount + 1; i++) {
            let newAcc = await web3.personal.newAccount('')
            ethAddresses.push(newAcc)
            tmp.push(
                await web3.eth.sendTransaction({
                    from: accounts[0],
                    to: newAcc,
                    value: sendValueWei,
                }),
            )
            console.log(newAcc + ' ' + i)
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
    })

    it('Init...', async () => {
        await web3.personal.unlockAccount(ethAddresses[0], '')
        tokenInstance = await Token.new(name, symbol, decimals, totalSupply, { from: ethAddresses[0] })
        assert.ok(tokenInstance)

        let tmp = []
        let ideal = [totalSupply, decimals, name, symbol, ethAddresses[0]]

        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.decimals()).valueOf())
        tmp.push((await tokenInstance.name()).valueOf())
        tmp.push((await tokenInstance.symbol()).valueOf())
        tmp.push((await tokenInstance.owner()).valueOf())

        for (let i = 1; i < ethAddresses.length; i++) {
            tmp.push(
                (await tokenInstance.transfer(ethAddresses[i], sendTokenValue, { from: ethAddresses[0] }))['logs'][0][
                    'args'
                ]['_value'].valueOf(),
            )
            ideal.push(sendTokenValue)
        }

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
        const svalue = 1000 * 10 ** decimals
        await web3.personal.unlockAccount(ethAddresses[1], '')
        tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[0])).valueOf()))
        tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[1])).valueOf()))
        tmp.push((await tokenInstance.getTransferFee(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.getTransferFee(ethAddresses[1])).valueOf())
        tmp.push(
            (await tokenInstance.transfer(ethAddresses[1], svalue, { from: ethAddresses[0] }))['logs'][0]['args']['_value'],
        )
        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push(
            (await tokenInstance.transfer(ethAddresses[0], svalue/2, { from: ethAddresses[1] }))['logs'][1]['args']['_value'],
        )
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())

        let ideal = [tmp[0],tmp[1], 0, 7, svalue, tmp[0] - svalue, tmp[1] + svalue, svalue/2, tmp[1] + svalue/2 * (1 - tmp[3]/100)]
        let result = utils.validateValues(tmp, ideal)

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('(Approve & TransferFrom...) Token', async () => {
        let tmp = []
        let value = 1000 * 10 ** decimals
        let subvalue = 500 * 10 ** decimals

        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
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
            value,
            value,
            subvalue,
            value - subvalue,
            tmp[0] - subvalue,
            new BigNumber(tmp[1]).add(subvalue),
        ]
        let result = utils.validateValues(tmp, ideal)
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('[stress-test] Token', async () => {
        let tmp = []
        let svalue = 1000 * 10 ** decimals

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

        tokenInstance.approve(ethAddresses[1], await tokenInstance.allowance(ethAddresses[0], ethAddresses[1]), svalue, {
            from: ethAddresses[0],
        })

        tmp.push(
            (await tokenInstance.transferFrom(ethAddresses[0], ethAddresses[1], svalue, { from: ethAddresses[1] }))[
                'logs'
            ][1]['args']['_value'],
        )

        let ideal = [tmp[0], true, true, true, svalue]
        let result = utils.validateValues(tmp, ideal)

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('(Prove...) total supply changing', async () => {
        const tmp = []
        const svalue = 100 * 10 ** decimals
        await web3.personal.unlockAccount(ethAddresses[0], '')
        tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[1])).valueOf()))
        tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[2])).valueOf()))
        tmp.push(parseInt((await tokenInstance.totalSupply()).valueOf()))

        //increase
        tmp.push((await tokenInstance.serviceIncreaseBalance(ethAddresses[1], svalue, {from: ethAddresses[0]}))[
            'logs'
            ][0]['args']['_value'],)
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.totalSupply()).valueOf())

        //decrease
        tmp.push((await tokenInstance.serviceDecreaseBalance(ethAddresses[1], svalue, {from: ethAddresses[0]}))[
            'logs'
            ][0]['args']['_value'],)
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.totalSupply()).valueOf())

        //burn
        tmp.push((await tokenInstance.serviceTokensBurn(ethAddresses[1], {from: ethAddresses[0]}))[
            'logs'
            ][0]['args']['_value'],)
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.totalSupply()).valueOf())

        //increase burned
        tmp.push((await tokenInstance.serviceIncreaseBalance(ethAddresses[1], tmp[0], {from: ethAddresses[0]}))[
            'logs'
            ][0]['args']['_value'],)
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.totalSupply()).valueOf())

        //redirect
        tmp.push((await tokenInstance.serviceRedirect(ethAddresses[1], ethAddresses[2], svalue, {from: ethAddresses[0]}))[
            'logs'
            ][0]['args']['_value'],)
        tmp.push((await tokenInstance.balanceOf(ethAddresses[1])).valueOf())
        tmp.push((await tokenInstance.balanceOf(ethAddresses[2])).valueOf())

        //redirect reverse
        tmp.push((await tokenInstance.serviceRedirect(ethAddresses[2], ethAddresses[1], svalue, {from: ethAddresses[0]}))[
            'logs'
            ][0]['args']['_value'],)
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
        //console.log(utils.tableEqual(tmp,ideal))
        let result = utils.validateValues(tmp, ideal)
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
})
