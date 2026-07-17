import React from 'react';
import { useTranslations } from 'next-intl';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = ""
}: PaginationProps) {
  const t = useTranslations('common');
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, currentPage + 2);
      if (currentPage <= 3) endPage = 5;
      else if (currentPage >= totalPages - 2) startPage = totalPages - 4;
      for (let i = startPage; i <= endPage; i++) pages.push(i);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();
  const btnBase = "px-2.5 py-1.5 text-[13px] rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      <div className="text-[13px] text-zinc-500">
        {totalItems > 0 ? (
          <>{t('total')} <span className="text-zinc-300">{totalItems}</span>{t('showing')} <span className="text-zinc-300">{startItem}-{endItem}</span>{t('displayed')}</>
        ) : (
          t('noItemsToShow')
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
          className={`${btnBase} text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800`}
        >
          &laquo;
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className={`${btnBase} text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800`}
        >
          &lsaquo;
        </button>

        {pageNumbers.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
            className={`${btnBase} min-w-[32px] ${
              page === currentPage
                ? 'bg-[#111167] text-white font-medium'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className={`${btnBase} text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800`}
        >
          &rsaquo;
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Last page"
          className={`${btnBase} text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800`}
        >
          &raquo;
        </button>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePagination(items: any[], itemsPerPage: number = 15) {
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = items.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return {
    currentPage,
    currentItems,
    totalPages,
    totalItems: items.length,
    handlePageChange,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
}
