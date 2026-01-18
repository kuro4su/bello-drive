import { ArrowDownAZ, ArrowUpAZ, Calendar, FileText, HardDrive, LayoutGrid, List } from "lucide-react";

const SortControls = ({ sortBy, setSortBy, sortOrder, setSortOrder, viewMode, setViewMode }) => {
    const sortOptions = [
        { value: "date", label: "Date", icon: Calendar },
        { value: "name", label: "Name", icon: FileText },
        { value: "size", label: "Size", icon: HardDrive },
    ];

    const toggleOrder = () => {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    };

    return (
        <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-ctp-surface0/30 rounded-lg p-1">
                <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-md transition-all ${viewMode === "grid"
                        ? "bg-ctp-blue/20 text-ctp-blue"
                        : "text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0/50"
                        }`}
                    title="Grid View"
                >
                    <LayoutGrid size={16} />
                </button>
                <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-md transition-all ${viewMode === "list"
                        ? "bg-ctp-blue/20 text-ctp-blue"
                        : "text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0/50"
                        }`}
                    title="List View"
                >
                    <List size={16} />
                </button>
            </div>

            <div className="h-4 w-px bg-ctp-surface0"></div>

            <div className="flex items-center gap-2">
                {/* Sort By Dropdown */}
                <div className="flex items-center gap-1 bg-ctp-surface0/30 rounded-lg p-1">
                    {sortOptions.map((opt) => {
                        const Icon = opt.icon;
                        const isActive = sortBy === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => setSortBy(opt.value)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${isActive
                                    ? "bg-ctp-blue/20 text-ctp-blue"
                                    : "text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0/50"
                                    }`}
                                title={`Sort by ${opt.label}`}
                            >
                                <Icon size={14} />
                                <span className="hidden sm:inline">{opt.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Order Toggle */}
                <button
                    onClick={toggleOrder}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-ctp-surface0/30 text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0/50 transition-all"
                    title={sortOrder === "asc" ? "Ascending" : "Descending"}
                >
                    {sortOrder === "asc" ? (
                        <ArrowUpAZ size={16} />
                    ) : (
                        <ArrowDownAZ size={16} />
                    )}
                </button>
            </div>
        </div>
    );
};

export default SortControls;
