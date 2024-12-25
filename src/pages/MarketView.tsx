import React, { useState, useEffect } from "react";
import {
  Typography,
  Radio,
  message,
  Card,
  Row,
  Col,
  Pagination,
  Tag,
  Button,
  Modal,
} from "antd";
import { AptosClient } from "aptos";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { FilterSort } from "../components/FilterSort";
import { FilterParams, SortOption } from "../types/marketplace";
import { InputNumber } from "antd";


const { Title } = Typography;
const { Meta } = Card;

const client = new AptosClient("https://fullnode.devnet.aptoslabs.com/v1");

type NFT = {
  id: number;
  owner: string;
  name: string;
  description: string;
  uri: string;
  price: number;
  for_sale: boolean;
  rarity: number;
  listing_date: number;
  creator: string;
  royalty_percentage: number;
};
type InputTransactionData = {
  type: string; // e.g., "entry_function_payload"
  function: string; // Fully qualified function name
  type_arguments: string[];
  arguments: (string | number | boolean)[];
  data?: Record<string, any>; // Optional additional data
};

interface MarketViewProps {
  marketplaceAddr: string;
}

const rarityColors: { [key: number]: string } = {
  1: "green",
  2: "blue",
  3: "purple",
  4: "orange",
};

const rarityLabels: { [key: number]: string } = {
  1: "Common",
  2: "Uncommon",
  3: "Rare",
  4: "Super Rare",
};

const truncateAddress = (address: string, start = 6, end = 4) => {
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

const MarketView: React.FC<MarketViewProps> = ({ marketplaceAddr }) => {
  const { signAndSubmitTransaction } = useWallet();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [rarity, setRarity] = useState<"all" | number>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const [isBuyModalVisible, setIsBuyModalVisible] = useState(false);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [searchVisible, setSearchVisible] = useState(true);

  const [isOfferModalVisible, setIsOfferModalVisible] = useState(false);
  const [offerAmount, setOfferAmount] = useState<number>(0);

  const [tipAmount, setTipAmount] = useState<number>(0);

  const [filters, setFilters] = useState<FilterParams>({
    searchTerm: "",
    priceRange: [0, 20],
    rarity: "all",
  });

  const [filteredAndSortedNFTs, setFilteredAndSortedNFTs] = useState<NFT[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");

  const sortNFTs = (nfts: NFT[]) => {
    return [...nfts].sort((a, b) => {
      switch (sortBy) {
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "date_desc":
          const bDate = b.listing_date || 0;
          const aDate = a.listing_date || 0;
          return bDate - aDate;
        case "date_asc":
          const aDateAsc = a.listing_date || 0;
          const bDateAsc = b.listing_date || 0;
          return aDateAsc - bDateAsc;
        case "name_asc":
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        case "name_desc":
          return b.name.toLowerCase().localeCompare(a.name.toLowerCase());
        case "id_asc":
          return a.id - b.id;
        case "rarity_desc":
          return b.rarity - a.rarity;
        default:
          return 0;
      }
    });
  };

  useEffect(() => {
    handleFetchNfts(undefined);
  }, []);
  useEffect(() => {
    const filtered = filterNFTs(nfts);
    const sorted = sortNFTs(filtered);
    setFilteredAndSortedNFTs(sorted);
    setSearchVisible(true);
  }, [nfts, filters, sortBy]);






  
  

  const formatListingDate = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return "Not listed";
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };


  const initializeOfferStore = async () => {
    try {
      const payload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::initialize_offer_store`,
        type_arguments: [],
        arguments: []
      };
  
      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      await client.waitForTransaction(response.hash);
      message.success("Offer store initialized successfully!");
    } catch (error) {
      console.error("Error initializing offer store:", error);
      message.error("Failed to initialize offer store");
    }
  };
 



  const handleMakeOffer = async () => {
    if (!selectedNft) return;
  
    try {
      const offerAmountInOctas = Math.floor(offerAmount * 100000000);
  
      const payload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::make_offer`,
        type_arguments: [],
        arguments: [
          marketplaceAddr,
          selectedNft.id,
          offerAmountInOctas
        ]
      };
  
      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      await client.waitForTransaction(response.hash);
      
      message.success("Offer made successfully!");
      setIsOfferModalVisible(false);
      
      // Refresh NFT list
      handleFetchNfts(undefined);
    } catch (error) {
      console.error("Error making offer:", error);
      message.error("Failed to make offer. Please ensure you have sufficient funds.");
    }
  };
  
  

  const filterNFTs = (nfts: NFT[]) => {
    return nfts.filter((nft) => {
      // Search term matching
      const searchMatch = !filters.searchTerm
        ? true
        : nft.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          nft.description
            .toLowerCase()
            .includes(filters.searchTerm.toLowerCase()) ||
          nft.id.toString().includes(filters.searchTerm) ||
          nft.owner.toLowerCase().includes(filters.searchTerm.toLowerCase());

      // Price range matching
      const priceMatch = filters.priceRange
        ? nft.price >= filters.priceRange[0] &&
          nft.price <= filters.priceRange[1]
        : true;

      // Rarity matching
      const rarityMatch = filters.rarity
        ? filters.rarity === "all" || nft.rarity === Number(filters.rarity)
        : true;

      return searchMatch && priceMatch && rarityMatch;
    });
  };

  const displayedNFTs = sortNFTs(filterNFTs(nfts));

  const handleFetchNfts = async (selectedRarity: number | undefined) => {
    try {
      const response = await client.getAccountResource(
        marketplaceAddr,
        "0x3ed23f75dc96ed785388d48d31252e98e3b031fb3cdca6175f0a9c75d4489521::NFTMarketplace::Marketplace"
      );
      const nftList = (response.data as { nfts: NFT[] }).nfts;

      const hexToUint8Array = (hexString: string): Uint8Array => {
        const bytes = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
          bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
        }
        return bytes;
      };

      const decodedNfts = nftList.map((nft) => ({
        ...nft,
        name: new TextDecoder().decode(hexToUint8Array(nft.name.slice(2))),
        description: new TextDecoder().decode(
          hexToUint8Array(nft.description.slice(2))
        ),
        uri: new TextDecoder().decode(hexToUint8Array(nft.uri.slice(2))),
        price: nft.price / 100000000,
        listing_date: Number(nft.listing_date),
      }));

      const filteredNfts = decodedNfts.filter(
        (nft) =>
          nft.for_sale &&
          (selectedRarity === undefined || nft.rarity === selectedRarity)
      );

      setNfts(filteredNfts);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error fetching NFTs by rarity:", error);
      message.error("Failed to fetch NFTs.");
    }
  };

  const handleBuyClick = (nft: NFT) => {
    setSelectedNft(nft);
    setIsBuyModalVisible(true);
  };

  const handleCancelBuy = () => {
    setIsBuyModalVisible(false);
    setSelectedNft(null);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedNft) return;

    try {
      const priceInOctas = selectedNft.price * 100000000;
      const tipInOctas = tipAmount * 100000000;

      const entryFunctionPayload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::purchase_nft_with_royalty`,
        type_arguments: [],
        arguments: [
          marketplaceAddr,
          selectedNft.id.toString(),
          priceInOctas.toString(),
          tipInOctas.toString(),
        ],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(
        entryFunctionPayload
      );
      await client.waitForTransaction(response.hash);

      message.success("NFT purchased successfully!");
      setIsBuyModalVisible(false);
      handleFetchNfts(rarity === "all" ? undefined : rarity);
    } catch (error) {
      console.error("Error purchasing NFT:", error);
      message.error("Failed to purchase NFT.");
    }
  };

  const paginatedNfts = filteredAndSortedNFTs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div
      style={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Title level={2} style={{ marginBottom: "20px" }}>
        Marketplace
      </Title>
      <div style={{ marginBottom: "20px" }}>
        <Radio.Group
          value={rarity}
          onChange={(e) => {
            const selectedRarity = e.target.value;
            setRarity(selectedRarity);
            handleFetchNfts(
              selectedRarity === "all" ? undefined : selectedRarity
            );
          }}
          buttonStyle="solid"
        >
          <Radio.Button value="all">All</Radio.Button>
          <Radio.Button value={1}>Common</Radio.Button>
          <Radio.Button value={2}>Uncommon</Radio.Button>
          <Radio.Button value={3}>Rare</Radio.Button>
          <Radio.Button value={4}>Super Rare</Radio.Button>
        </Radio.Group>
      </div>
      <FilterSort
        onFilterChange={(newFilters: FilterParams) =>
          setFilters({ ...filters, ...newFilters })
        }
        onSortChange={(value: SortOption) => setSortBy(value)}
      />
      <Row
        gutter={[24, 24]}
        style={{
          marginTop: 20,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {paginatedNfts.map((nft) => (
          <Col
            key={nft.id}
            xs={24}
            sm={12}
            md={8}
            lg={6}
            xl={6}
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Card
              hoverable
              style={{
                width: "100%",
                maxWidth: "240px",
                margin: "0 auto",
              }}
              cover={<img alt={nft.name} src={nft.uri} />}
              actions={[
                <Button type="link" onClick={() => handleBuyClick(nft)}>
                  Buy
                </Button>,
                <Button
                  type="link"
                  onClick={() => {
                    setSelectedNft(nft);
                    setIsOfferModalVisible(true);
                  }}
                >
                  Make Offer
                </Button>,
              ]}
            >
              <Tag
                color={rarityColors[nft.rarity]}
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  marginBottom: "10px",
                }}
              >
                {rarityLabels[nft.rarity]}
              </Tag>

              <Meta title={nft.name} description={`Price: ${nft.price} APT`} />
              <p>{nft.description}</p>
              <p>ID: {nft.id}</p>
              <p>Owner: {truncateAddress(nft.owner)}</p>
            </Card>
          </Col>
        ))}
      </Row>
      <div style={{ marginTop: 30, marginBottom: 30 }}>
        <Pagination
          current={currentPage}
          pageSize={pageSize}
          total={filteredAndSortedNFTs.length}
          onChange={(page) => setCurrentPage(page)}
          style={{ display: "flex", justifyContent: "center" }}
        />
      </div>
      <Modal
        title="Purchase NFT"
        visible={isBuyModalVisible}
        onCancel={handleCancelBuy}
        footer={[
          <Button key="cancel" onClick={handleCancelBuy}>
            Cancel
          </Button>,
          <Button key="confirm" type="primary" onClick={handleConfirmPurchase}>
            Confirm Purchase
          </Button>,
        ]}
      >
        {selectedNft && (
          <>
            <p>
              <strong>NFT ID:</strong> {selectedNft.id}
            </p>
            <p>
              <strong>Name:</strong> {selectedNft.name}
            </p>
            <p>
              <strong>Description:</strong> {selectedNft.description}
            </p>
            <p>
              <strong>Rarity:</strong> {rarityLabels[selectedNft.rarity]}
            </p>
            <p>
              <strong>Price:</strong> {selectedNft.price} APT
            </p>
            <p>
              <strong>Owner:</strong> {truncateAddress(selectedNft.owner)}
            </p>
            <p>Listed: {formatListingDate(selectedNft.listing_date)}</p>
            <p>
              <strong>Creator:</strong> {truncateAddress(selectedNft.creator)}
            </p>
            <p>
              <strong>Royalty:</strong> {selectedNft.royalty_percentage}%
            </p>
            <p>
              <strong>Royalty Amount:</strong>{" "}
              {(
                (selectedNft.price * selectedNft.royalty_percentage) /
                100
              ).toFixed(2)}{" "}
              APT
            </p>
            <div style={{ marginTop: 20 }}>
              <Typography.Text strong>
                Tip Amount (APT)(Optional)
              </Typography.Text>
              <InputNumber
                min={0}
                step={0.1}
                precision={2}
                value={tipAmount}
                onChange={(value) => setTipAmount(value || 0)}
                style={{ width: "100%", marginTop: 8 }}
                placeholder="Enter tip amount (optional)"
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <Typography.Text type="secondary">
                Total Payment: {(selectedNft.price + tipAmount).toFixed(2)} APT
              </Typography.Text>
            </div>
          </>
        )}
      </Modal>
     
      <Modal
        title="Make Offer"
        visible={isOfferModalVisible}
        onCancel={() => setIsOfferModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsOfferModalVisible(false)}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" onClick={handleMakeOffer}>
            Submit Offer
          </Button>,
        ]}
      >
        {selectedNft && (
          <>
            <p>
              <strong>NFT Name:</strong> {selectedNft.name}
            </p>
            <p>
              <strong>Current Price:</strong> {selectedNft.price} APT
            </p>
            <div style={{ marginTop: 20 }}>
              <Typography.Text strong>Offer Amount (APT)</Typography.Text>
              <InputNumber
                min={0}
                step={0.1}
                precision={2}
                value={offerAmount}
                onChange={(value) => setOfferAmount(value || 0)}
                style={{ width: "100%", marginTop: 8 }}
                placeholder="Enter your offer amount"
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default MarketView;
