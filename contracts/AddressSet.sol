pragma solidity 0.4.24;

// Actually, it is not a RingList anymore. It's a Random Access List
// however, needed cyclic list functionality could modeled on top of Random Access List
// Recommended name - AddressSet
library AddressSet {

    // Name is kept for drop-in replacement reasons. Recommended name `Instance`
    struct Instance {
        address[] list;
        mapping(address => uint256) idx; // actually stores indexes incremented by 1
    }

    // _direction parameter is kept for drop-in replacement consistency; consider remove the parameter
    // Gas efficient version of push
    function push(Instance storage self, address addr) internal returns (bool) {
        if (self.idx[addr] != 0) return false;
        self.idx[addr] = self.list.push(addr);
        return true;
    }

    // Now in O(1)
    function sizeOf(Instance storage self) internal view returns (uint256) {
        return self.list.length;
    }

    // Gets i-th address in O(1) time (RANDOM ACCESS!!!)
    function getAddress(Instance storage self, uint256 index) internal view returns (address) {
        return (index < self.list.length) ? self.list[index] : address(0);
    }

    // Gas efficient version of remove
    function remove(Instance storage self, address addr) internal returns (bool) {
        if (self.idx[addr] == 0) return false;
        uint256 idx = self.idx[addr];
        delete self.idx[addr];
        if (self.list.length == idx) {
            self.list.length--;
        } else {
            address last = self.list[self.list.length-1];
            self.list.length--;
            self.list[idx-1] = last;
            self.idx[last] = idx;
        }
        return true;
    }
}