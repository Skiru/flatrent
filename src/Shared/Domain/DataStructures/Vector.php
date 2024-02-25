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
     * @param array<int, T> $items
     * @return self<T>
     */
    public static function fromArray(array $items): self
    {
        return new self(new NativeVector($items));
    }

    /**
     * @template R
     * @param Closure(T): R $closure
     * @return Vector<R>
     */
    public function transform(Closure $closure): self
    {
        return new self($this->vector->map($closure));
    }

    public function containsUsingFunction(Closure $closure): bool
    {
        $this->vector->find()
    }

    /**
     * @return array<int, T>
     */
    public function toArray(): array
    {
        return $this->vector->toArray();
    }
}
