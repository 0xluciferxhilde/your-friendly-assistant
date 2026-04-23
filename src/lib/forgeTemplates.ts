// Solidity contract code generators for LitVM Contract Forge.
// Pure string builders — no compilation, no deploy. User copies / downloads
// the generated source and deploys via Remix or our /deploy page.

export type ForgeKind = "erc20" | "nft" | "staking" | "vesting" | "factory";

// Sanitize a string into a valid Solidity identifier (used for contract names
// derived from token symbols / user input).
export function safeIdent(s: string, fallback: string): string {
  const cleaned = (s || "").replace(/[^A-Za-z0-9_]/g, "");
  if (!cleaned) return fallback;
  return /^[0-9]/.test(cleaned) ? "_" + cleaned : cleaned;
}

// Returns the actual `contract X` name that the generator emits, so the
// compiler / deployer can target it.
export function getContractName(
  kind: ForgeKind,
  forms: { erc20: Erc20Form; nft: NftForm; staking: StakingForm; vesting: VestingForm; factory: FactoryForm }
): string {
  switch (kind) {
    case "erc20":
      return safeIdent(forms.erc20.symbol, "MTK");
    case "nft":
      return safeIdent(forms.nft.symbol, "MNFT");
    case "staking":
      return safeIdent(forms.staking.contractName, "TokenStaking");
    case "vesting":
      return safeIdent(forms.vesting.contractName, "TokenVesting");
    case "factory":
      return safeIdent(forms.factory.contractName, "LitVMTokenFactory");
  }
}

export type Erc20Form = {
  name: string;
  symbol: string;
  supply: string;
  decimals: string;
  owner: string;
  mintable: boolean;
  burnable: boolean;
  pausable: boolean;
  ownable: boolean;
  tax: boolean;
  reentrancyGuard: boolean;
  taxBps: string;
  taxAddr: string;
};

export type NftForm = {
  name: string;
  symbol: string;
  maxSupply: string;
  price: string;
  perWallet: string;
  baseUri: string;
  whitelist: boolean;
  reveal: boolean;
  royalty: boolean;
  royaltyBps: string;
  royaltyAddr: string;
};

export type StakingForm = {
  contractName: string;
  stakeToken: string;
  rewardToken: string;
  apr: string;
  lockDays: string;
  minStake: string;
  emergency: boolean;
  pausable: boolean;
  autoCompound: boolean;
};

export type VestingForm = {
  contractName: string;
  token: string;
  cliffDays: string;
  durationDays: string;
  beneficiary: string;
  amount: string;
  revocable: boolean;
  multiBeneficiary: boolean;
  emitEvents: boolean;
};

export type FactoryForm = {
  contractName: string;
  fee: string;
  owner: string;
  mintable: boolean;
  burnable: boolean;
  pausable: boolean;
  customDecimals: boolean;
  trackTokens: boolean;
  whitelist: boolean;
};

const HEADER = (title: string) => `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
// ================================================================
//  ${title}
//  LitVM LiteForge  |  Chain 4441  |  https://api.republicstats.xyz/litvm/rpc
// ================================================================
`;

export function genErc20(f: Erc20Form): string {
  const name = f.name || "MyToken";
  const sym = f.symbol || "MTK";
  const cname = safeIdent(sym, "MTK");
  const supply = f.supply || "1000000000";
  const dec = f.decimals || "18";
  const owner = f.owner || "msg.sender";
  const taxAddr = f.taxAddr || "msg.sender";

  const imports: string[] = [`import "@openzeppelin/contracts/token/ERC20/ERC20.sol";`];
  const inh: string[] = ["ERC20"];

  if (f.ownable) {
    imports.push(`import "@openzeppelin/contracts/access/Ownable.sol";`);
    inh.push("Ownable");
  }
  if (f.pausable) {
    imports.push(`import "@openzeppelin/contracts/utils/Pausable.sol";`);
    inh.push("Pausable");
  }
  if (f.burnable) {
    imports.push(`import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";`);
    inh.push("ERC20Burnable");
  }
  if (f.reentrancyGuard) {
    imports.push(`import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";`);
    inh.push("ReentrancyGuard");
  }

  const taxState = f.tax
    ? `    uint256 public taxBps = ${f.taxBps || "200"};
    address public taxReceiver;
    mapping(address => bool) public taxExempt;
`
    : "";

  const ctorTax = f.tax
    ? `        taxReceiver = ${taxAddr};
        taxExempt[${owner}] = true;
`
    : "";

  const mintFn = f.mintable
    ? `
    function mint(address to, uint256 amount) external${f.ownable ? " onlyOwner" : ""} { _mint(to, amount); }`
    : "";

  const pauseFns = f.pausable
    ? `
    function pause() external${f.ownable ? " onlyOwner" : ""} { _pause(); }
    function unpause() external${f.ownable ? " onlyOwner" : ""} { _unpause(); }`
    : "";

  const taxFns = f.tax
    ? `
    function setTax(uint256 bps) external${f.ownable ? " onlyOwner" : ""} { require(bps <= 1000, "Max 10%"); taxBps = bps; }
    function setTaxReceiver(address addr) external${f.ownable ? " onlyOwner" : ""} { taxReceiver = addr; }
    function setTaxExempt(address addr, bool val) external${f.ownable ? " onlyOwner" : ""} { taxExempt[addr] = val; }`
    : "";

  const updateBody = f.tax
    ? `        if (from != address(0) && to != address(0) && taxBps > 0 && !taxExempt[from] && !taxExempt[to]) {
            uint256 fee = (value * taxBps) / 10000;
            super._update(from, taxReceiver, fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }`
    : `        super._update(from, to, value);`;

  return `${HEADER(`${name} (${sym})`)}${imports.join("\n")}

contract ${cname} is ${inh.join(", ")} {
    uint8 private _dec;
${taxState}
    constructor() ERC20("${name}", "${sym}")${f.ownable ? ` Ownable(${owner})` : ""} {
        _dec = ${dec};
${ctorTax}        _mint(${owner}, ${supply} * (10 ** ${dec}));
    }

    function decimals() public view override returns (uint8) { return _dec; }${mintFn}${pauseFns}${taxFns}

    function _update(address from, address to, uint256 value) internal override${f.pausable ? " whenNotPaused" : ""} {
${updateBody}
    }
}
`;
}

export function genNft(f: NftForm): string {
  const name = f.name || "MyNFT";
  const sym = f.symbol || "MNFT";
  const cname = safeIdent(sym, "MNFT");
  const maxS = f.maxSupply || "10000";
  const price = f.price || "0.05";
  const pw = f.perWallet || "5";
  const uri = f.baseUri || "https://api.example.xyz/meta/";
  const royBps = f.royaltyBps || "500";
  const royAddr = f.royaltyAddr || "msg.sender";

  return `${HEADER(`${name} (${sym}) | Max: ${maxS} | Price: ${price} zkLTC`)}import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
${f.royalty ? `import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
` : ""}
contract ${cname} is ERC721, Ownable${f.royalty ? ", IERC2981" : ""} {
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = ${maxS};
    uint256 public mintPrice = ${price} ether;
    uint256 public maxPerWallet = ${pw};
    uint256 private _total;
    bool public saleActive;
${f.whitelist ? `    bool public wlActive = true;
    mapping(address => bool) public whitelist;
` : ""}    mapping(address => uint256) public minted;
${f.reveal ? `    string private _hiddenURI = "ipfs://REPLACE_WITH_HIDDEN_URI";
    bool public revealed;
` : ""}    string private _base;
${f.royalty ? `    uint256 private _roybps = ${royBps};
    address private _royRec;
` : ""}
    constructor() ERC721("${name}", "${sym}") Ownable(msg.sender) {
        _base = "${uri}";
${f.royalty ? `        _royRec = ${royAddr};
` : ""}    }

    function mint(uint256 qty) external payable {
        require(saleActive, "Sale off");
        require(_total + qty <= MAX_SUPPLY, "Exceeds supply");
        require(minted[msg.sender] + qty <= maxPerWallet, "Wallet limit");
        require(msg.value >= mintPrice * qty, "Not enough zkLTC");
        minted[msg.sender] += qty;
        for (uint256 i = 0; i < qty; i++) { _total++; _safeMint(msg.sender, _total); }
    }
${f.whitelist ? `
    function wlMint(uint256 qty) external payable {
        require(wlActive, "WL off");
        require(whitelist[msg.sender], "Not whitelisted");
        require(_total + qty <= MAX_SUPPLY, "Exceeds supply");
        require(msg.value >= mintPrice * qty, "Not enough zkLTC");
        for (uint256 i = 0; i < qty; i++) { _total++; _safeMint(msg.sender, _total); }
    }
    function setWL(address[] calldata addrs, bool val) external onlyOwner {
        for (uint i = 0; i < addrs.length; i++) whitelist[addrs[i]] = val;
    }
    function setWLActive(bool val) external onlyOwner { wlActive = val; }
` : ""}
    function ownerMint(address to, uint256 qty) external onlyOwner {
        require(_total + qty <= MAX_SUPPLY, "Exceeds supply");
        for (uint256 i = 0; i < qty; i++) { _total++; _safeMint(to, _total); }
    }

    function totalSupply() public view returns (uint256) { return _total; }
    function setSaleActive(bool val) external onlyOwner { saleActive = val; }
    function setMintPrice(uint256 p) external onlyOwner { mintPrice = p; }
    function setBaseURI(string calldata uri_) external onlyOwner { _base = uri_; }
${f.reveal ? `    function reveal(string calldata uri_) external onlyOwner { revealed = true; _base = uri_; }
` : ""}
    function tokenURI(uint256 id) public view override returns (string memory) {
        require(_ownerOf(id) != address(0), "Nonexistent");
${f.reveal ? `        if (!revealed) return _hiddenURI;
` : ""}        return string(abi.encodePacked(_base, id.toString(), ".json"));
    }
${f.royalty ? `
    function royaltyInfo(uint256, uint256 salePrice) external view override returns (address, uint256) {
        return (_royRec, (salePrice * _roybps) / 10000);
    }
    function supportsInterface(bytes4 id) public view override(ERC721, IERC165) returns (bool) {
        return id == type(IERC2981).interfaceId || super.supportsInterface(id);
    }
` : ""}
    function withdraw() external onlyOwner {
        (bool ok,) = owner().call{value: address(this).balance}("");
        require(ok, "Withdraw fail");
    }
}
`;
}

export function genStaking(f: StakingForm): string {
  const cname = safeIdent(f.contractName, "TokenStaking");
  const stake = f.stakeToken || "0x0000000000000000000000000000000000000000";
  const reward = f.rewardToken.trim() || stake;
  const apr = Number(f.apr || "12");
  const lock = f.lockDays || "30";
  const min = f.minStake || "1";

  return `${HEADER(`${cname} | APR: ${apr}% | Lock: ${lock} days`)}import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
${f.pausable ? `import "@openzeppelin/contracts/utils/Pausable.sol";
` : ""}
contract ${cname} is Ownable, ReentrancyGuard${f.pausable ? ", Pausable" : ""} {
    using SafeERC20 for IERC20;

    IERC20 public immutable STAKE_TOKEN;
    IERC20 public immutable REWARD_TOKEN;
    uint256 public constant LOCK = ${lock} days;
    uint256 public constant MIN  = ${min} ether;
    uint256 public rewardBps     = ${Math.round(apr * 100)};

    struct Info { uint256 amount; uint256 start; uint256 lastClaim; uint256 pending; }
    mapping(address => Info) public stakes;
    uint256 public totalStaked;

    event Staked(address indexed u, uint256 amt);
    event Unstaked(address indexed u, uint256 amt);
    event Claimed(address indexed u, uint256 amt);

    constructor() Ownable(msg.sender) {
        STAKE_TOKEN  = IERC20(${stake});
        REWARD_TOKEN = IERC20(${reward});
    }

    function pending(address u) public view returns (uint256) {
        Info memory s = stakes[u];
        if (s.amount == 0) return s.pending;
        uint256 e = block.timestamp - s.lastClaim;
        return s.pending + (s.amount * rewardBps * e) / (10000 * 365 days);
    }

    function stake(uint256 amt) external nonReentrant${f.pausable ? " whenNotPaused" : ""} {
        require(amt >= MIN, "Below min");
        Info storage s = stakes[msg.sender];
        if (s.amount > 0) s.pending = pending(msg.sender);
        STAKE_TOKEN.safeTransferFrom(msg.sender, address(this), amt);
        s.amount += amt;
        s.start = s.start == 0 ? block.timestamp : s.start;
        s.lastClaim = block.timestamp;
        totalStaked += amt;
        emit Staked(msg.sender, amt);
    }

    function claim() external nonReentrant${f.pausable ? " whenNotPaused" : ""} {
        Info storage s = stakes[msg.sender];
        uint256 r = pending(msg.sender);
        require(r > 0, "No rewards");
        s.pending = 0;
        s.lastClaim = block.timestamp;
        REWARD_TOKEN.safeTransfer(msg.sender, r);
        emit Claimed(msg.sender, r);
    }
${f.autoCompound ? `
    function compound() external nonReentrant${f.pausable ? " whenNotPaused" : ""} {
        require(address(STAKE_TOKEN) == address(REWARD_TOKEN), "Diff tokens");
        Info storage s = stakes[msg.sender];
        uint256 r = pending(msg.sender);
        require(r > 0, "No rewards");
        s.pending = 0;
        s.amount += r;
        s.lastClaim = block.timestamp;
        totalStaked += r;
        emit Staked(msg.sender, r);
    }
` : ""}
    function unstake(uint256 amt) external nonReentrant {
        Info storage s = stakes[msg.sender];
        require(s.amount >= amt, "Insufficient");
        require(block.timestamp >= s.start + LOCK, "Locked");
        s.pending = pending(msg.sender);
        s.amount -= amt;
        s.lastClaim = block.timestamp;
        totalStaked -= amt;
        STAKE_TOKEN.safeTransfer(msg.sender, amt);
        emit Unstaked(msg.sender, amt);
    }
${f.emergency ? `
    function emergencyWithdraw() external nonReentrant {
        Info storage s = stakes[msg.sender];
        require(s.amount > 0, "Nothing");
        uint256 a = s.amount;
        s.amount = 0;
        s.pending = 0;
        totalStaked -= a;
        STAKE_TOKEN.safeTransfer(msg.sender, a);
    }
` : ""}
    function setRate(uint256 bps) external onlyOwner { rewardBps = bps; }
    function depositRewards(uint256 amt) external onlyOwner {
        REWARD_TOKEN.safeTransferFrom(msg.sender, address(this), amt);
    }
${f.pausable ? `    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
` : ""}}
`;
}

export function genVesting(f: VestingForm): string {
  const cname = safeIdent(f.contractName, "TokenVesting");
  const token = f.token || "0x0000000000000000000000000000000000000000";
  const cliff = f.cliffDays || "90";
  const dur = f.durationDays || "365";

  if (f.multiBeneficiary) {
    return `${HEADER(`${cname} | Cliff: ${cliff}d | Duration: ${dur}d (Multi)`)}import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ${cname} is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable TOKEN;
    uint256 public constant CLIFF    = ${cliff} days;
    uint256 public constant DURATION = ${dur} days;

    struct Schedule { address ben; uint256 total; uint256 released; uint256 start; bool revoked; }
    mapping(uint256 => Schedule) public schedules;
    uint256 public count;
${f.emitEvents ? `    event Released(address indexed ben, uint256 amt);
    event Created(uint256 indexed id, address indexed ben, uint256 amt);
` : ""}
    constructor() Ownable(msg.sender) { TOKEN = IERC20(${token}); }

    function create(address ben, uint256 amt) external onlyOwner returns (uint256 id) {
        TOKEN.safeTransferFrom(msg.sender, address(this), amt);
        id = count++;
        schedules[id] = Schedule(ben, amt, 0, block.timestamp, false);
${f.emitEvents ? `        emit Created(id, ben, amt);
` : ""}    }

    function releasable(uint256 id) public view returns (uint256) {
        Schedule memory s = schedules[id];
        if (s.revoked) return 0;
        if (block.timestamp < s.start + CLIFF) return 0;
        uint256 e = block.timestamp - (s.start + CLIFF);
        uint256 v = e >= DURATION ? s.total : (s.total * e) / DURATION;
        return v - s.released;
    }

    function release(uint256 id) external nonReentrant {
        Schedule storage s = schedules[id];
        require(msg.sender == s.ben, "Not ben");
        uint256 r = releasable(id);
        require(r > 0, "Nothing");
        s.released += r;
        TOKEN.safeTransfer(s.ben, r);
${f.emitEvents ? `        emit Released(s.ben, r);
` : ""}    }
${f.revocable ? `
    function revoke(uint256 id) external onlyOwner {
        Schedule storage s = schedules[id];
        require(!s.revoked, "Done");
        uint256 r = s.total - s.released;
        s.revoked = true;
        if (r > 0) TOKEN.safeTransfer(owner(), r);
    }
` : ""}}
`;
  }

  const benef = f.beneficiary;
  const amount = f.amount || "0";

  return `${HEADER(`${cname} | Cliff: ${cliff}d | Duration: ${dur}d`)}import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ${cname} is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable TOKEN;
    uint256 public constant CLIFF    = ${cliff} days;
    uint256 public constant DURATION = ${dur} days;

    address public beneficiary;
    uint256 public totalAmt;
    uint256 public released;
    uint256 public start;
    bool public revoked;
${f.emitEvents ? `    event Released(address indexed ben, uint256 amt);
` : ""}
    constructor() Ownable(msg.sender) {
        TOKEN = IERC20(${token});
${benef ? `        beneficiary = ${benef};
        totalAmt = ${amount} ether;
        start = block.timestamp;
` : ""}    }

    function setBeneficiary(address addr) external onlyOwner {
        require(beneficiary == address(0), "Already set");
        beneficiary = addr;
        start = block.timestamp;
    }
    function setTotal(uint256 amt) external onlyOwner { require(released == 0, "Started"); totalAmt = amt; }

    function vested() public view returns (uint256) {
        if (start == 0) return 0;
        if (revoked) return released;
        if (block.timestamp < start + CLIFF) return 0;
        uint256 e = block.timestamp - (start + CLIFF);
        return e >= DURATION ? totalAmt : (totalAmt * e) / DURATION;
    }

    function release() external nonReentrant {
        require(msg.sender == beneficiary || msg.sender == owner(), "Unauth");
        uint256 r = vested() - released;
        require(r > 0, "Nothing");
        released += r;
        TOKEN.safeTransfer(beneficiary, r);
${f.emitEvents ? `        emit Released(beneficiary, r);
` : ""}    }
${f.revocable ? `
    function revoke() external onlyOwner {
        require(!revoked, "Done");
        uint256 r = totalAmt - vested();
        revoked = true;
        if (r > 0) TOKEN.safeTransfer(owner(), r);
    }
` : ""}}
`;
}

export function genFactory(f: FactoryForm): string {
  const cname = safeIdent(f.contractName, "LitVMTokenFactory");
  const fee = f.fee || "0.05";
  const owner = f.owner || "msg.sender";

  const ctorParams = [
    "string memory n",
    "string memory s",
    f.customDecimals ? "uint8 d" : null,
    "uint256 supply",
    f.mintable ? "bool m" : null,
    f.burnable ? "bool b" : null,
    f.pausable ? "bool p" : null,
    "address creator",
  ].filter(Boolean).join(", ");

  const deployParams = [
    "string calldata name",
    "string calldata symbol",
    f.customDecimals ? "uint8 decimals" : null,
    "uint256 supply",
    f.mintable ? "bool mintable" : null,
    f.burnable ? "bool burnable" : null,
    f.pausable ? "bool pausable" : null,
  ].filter(Boolean).join(", ");

  const ctorArgs = [
    "name",
    "symbol",
    f.customDecimals ? "decimals" : null,
    "supply",
    f.mintable ? "mintable" : null,
    f.burnable ? "burnable" : null,
    f.pausable ? "pausable" : null,
    "msg.sender",
  ].filter(Boolean).join(", ");

  return `${HEADER(`${cname} | Fee: ${fee} zkLTC per token deploy`)}import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FactoryToken is ERC20, Ownable {
    uint8 private _d;
${f.mintable ? "    bool public mintable;\n" : ""}${f.burnable ? "    bool public burnable;\n" : ""}${f.pausable ? "    bool public pausable;\n    bool private _paused;\n" : ""}
    constructor(${ctorParams}) ERC20(n, s) Ownable(creator) {
        _d = ${f.customDecimals ? "d" : "18"};
${f.mintable ? "        mintable = m;\n" : ""}${f.burnable ? "        burnable = b;\n" : ""}${f.pausable ? "        pausable = p;\n" : ""}        _mint(creator, supply);
    }

    function decimals() public view override returns (uint8) { return _d; }
${f.mintable ? `    function mint(address to, uint256 amt) external onlyOwner { require(mintable, "Disabled"); _mint(to, amt); }
` : ""}${f.burnable ? `    function burn(uint256 amt) external { require(burnable, "Disabled"); _burn(msg.sender, amt); }
` : ""}${f.pausable ? `    function pause() external onlyOwner { require(pausable, "Disabled"); _paused = true; }
    function unpause() external onlyOwner { require(pausable, "Disabled"); _paused = false; }
    function _update(address from, address to, uint256 v) internal override { require(!_paused, "Paused"); super._update(from, to, v); }
` : ""}}

contract ${cname} is Ownable {
    uint256 public fee = ${fee} ether;
${f.whitelist ? `    mapping(address => bool) public allowed;
    bool public wlOnly;
` : ""}${f.trackTokens ? `    address[] public all;
    mapping(address => address[]) public byCreator;
` : ""}    event Deployed(address indexed token, address indexed creator, string name, string symbol);

    constructor() Ownable(${owner}) {}

    function deploy(${deployParams}) external payable returns (address) {
        require(msg.value >= fee, "Fee low");
        require(bytes(name).length > 0 && bytes(symbol).length > 0, "Name required");
        require(supply > 0, "Supply > 0");
${f.whitelist ? `        require(!wlOnly || allowed[msg.sender], "Not allowed");
` : ""}        (bool ok,) = owner().call{value: msg.value}("");
        require(ok, "Fee transfer fail");
        FactoryToken t = new FactoryToken(${ctorArgs});
        address a = address(t);
${f.trackTokens ? `        all.push(a);
        byCreator[msg.sender].push(a);
` : ""}        emit Deployed(a, msg.sender, name, symbol);
        return a;
    }

    function setFee(uint256 f_) external onlyOwner { fee = f_; }
${f.whitelist ? `    function setAllowed(address a, bool v) external onlyOwner { allowed[a] = v; }
    function setWLOnly(bool v) external onlyOwner { wlOnly = v; }
` : ""}${f.trackTokens ? `    function getAll() external view returns (address[] memory) { return all; }
    function getByCreator(address c) external view returns (address[] memory) { return byCreator[c]; }
` : ""}    function withdraw() external onlyOwner {
        (bool ok,) = owner().call{value: address(this).balance}("");
        require(ok, "Withdraw fail");
    }
    receive() external payable {}
}
`;
}
