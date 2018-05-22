pragma solidity ^0.4.23;

import "./SafeMath.sol";
import "./UHCToken.sol";
import "./GroupManager.sol";

contract EthReceiver is GroupManager{

    using SafeMath for uint256;

    uint256 public              weiPerMinToken;

    UHCToken public            token;

    constructor (address _token, uint256 _weiPerMinToken) public{
        token = UHCToken(_token);
        weiPerMinToken = _weiPerMinToken;
    }

    modifier onlyOwner(){
        require(msg.sender == token.owner());
        _;
    }

    function transfer(address _to, uint256 _value) external minGroup(currentState._backend){
        token.transfer( _to, _value);
    }

    function serviceGetWei() external minGroup(currentState._admin) returns(bool success) {
        uint256 contractBalance = address(this).balance;
        token.owner().transfer(contractBalance);

        return true;
    }

    function serviceSetWeiPerMinToken(uint256 _weiPerMinToken) external minGroup(currentState._admin)  {
        require (_weiPerMinToken > 0);

        weiPerMinToken = _weiPerMinToken;
    }

    function serviceDestroy() external onlyOwner() {
        selfdestruct(token.owner());
    }

    function calculateTokenCount(uint256 weiAmount) external constant returns(uint256 summary){
        return weiAmount.div(weiPerMinToken);
    }

    function () external payable{
        uint256 tokenCount = msg.value.div(weiPerMinToken);
        require(tokenCount > 0);

        token.transfer( msg.sender, tokenCount);
    }
}