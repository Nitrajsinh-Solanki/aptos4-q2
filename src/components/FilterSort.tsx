import React from "react";
import { Select, Slider, Space, Input } from "antd";
import { FilterParams, SortOption } from "../types/marketplace";

const { Option } = Select;

interface FilterSortProps {
  onFilterChange: (filters: FilterParams) => void;
  onSortChange: (value: SortOption) => void;
}

export const FilterSort: React.FC<FilterSortProps> = ({
  onFilterChange,
  onSortChange,
}) => {
  return (
    <Space direction="vertical" style={{ width: "100%", marginBottom: 20 }}>
      <Input.Search
        placeholder="Search by name, ID, or description"
        allowClear
        enterButton
        onChange={(e) => onFilterChange({ searchTerm: e.target.value })}
        onSearch={(value) => onFilterChange({ searchTerm: value })}
      />

      <Select
        style={{ width: 200 }}
        placeholder="Sort by"
        onChange={(value: SortOption) => onSortChange(value)}
      >
        <Option value="price_asc">Price: Low to High</Option>
        <Option value="price_desc">Price: High to Low</Option>
        <Option value="date_desc">Recently Listed</Option>
        <Option value="date_asc">Oldest Listed</Option>
        <Option value="name_asc">Name A-Z</Option>
        <Option value="name_desc">Name Z-A</Option>
        <Option value="id_asc">ID: Low to High</Option>
        <Option value="rarity_desc">Rarity: High to Low</Option>
      </Select>

      <Slider
        range
        marks={{ 0: "0 APT", 20: "20 APT" }}
        defaultValue={[0, 20]}
        max={20}
        onChange={(value: number[]) =>
          onFilterChange({ priceRange: [value[0], value[1]] })
        }
      />
    </Space>
  );
};