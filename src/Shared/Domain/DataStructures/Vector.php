<?php

declare(strict_types=1);

namespace App\Shared\Domain\DataStructures;

use Closure;
use Ds\Vector as NativeVector;

/**
 * @template T
 */
final readonly class Vector
{
    /**
     * @param NativeVector<T> $vector
     */
    private function __construct(private NativeVector $vector)
    {
    }

    /**
     * @template X
     * @param array<int, X> $items
     * @return self<X>
     */
    public static function fromArray(array $items): self
    {
        /** @var Vector<X> */
        return new self(new NativeVector($items));
    }

    /**
     * @template R
     * @param Closure(T): R $closure
     * @return self<R>
     */
    public function transform(Closure $closure): self
    {
        return new self($this->vector->map($closure));
    }

    /**
     * @param Closure(T): bool $closure
     * @return ?T
     */
    public function findOneByClosure(Closure $closure): mixed
    {
        $found         = $this->vector->filter($closure);
        $numberOfFound = $found->count();

        if ($numberOfFound > 1) {
            throw new \LogicException(sprintf('More than one result found. Found %d', $numberOfFound));
        }

        if ($found->isEmpty()) {
            return null;
        }

        return $found->first();
    }

    /**
     * @return array<int, T>
     */
    public function toArray(): array
    {
        return $this->vector->toArray();
    }
}
