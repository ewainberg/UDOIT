<?php

namespace App\Tests\Services;

use App\Services\BedrockRecommendationService;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

class BedrockRecommendationServiceTest extends TestCase
{
    private array $environment = [];

    protected function setUp(): void
    {
        foreach (['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'BEDROCK_MODEL'] as $name) {
            $this->environment[$name] = $_ENV[$name] ?? null;
        }

        $_ENV['OPENAI_API_KEY'] = 'test-key';
        $_ENV['BEDROCK_MODEL'] = 'amazon.nova-lite-v1:0';
    }

    protected function tearDown(): void
    {
        foreach ($this->environment as $name => $value) {
            if ($value === null) {
                unset($_ENV[$name]);
                continue;
            }
            $_ENV[$name] = $value;
        }
    }

    public function testReturnsValidatedRecommendation(): void
    {
        $client = new MockHttpClient(new MockResponse(json_encode([
            'output' => [
                'message' => [
                    'content' => [[
                        'text' => json_encode([
                        'action' => 'set-value',
                        'value' => 'true',
                        'confidence' => 'high',
                        'reason' => 'The button controls visible content.',
                        ]),
                    ]],
                ],
            ],
        ])));
        $service = new BedrockRecommendationService($client);

        $recommendation = $service->recommend([
            'attribute' => ['name' => 'aria-expanded'],
            'context' => ['target' => ['tagName' => 'button']],
            'recommendation' => [
                'mode' => 'selection',
                'allowedActions' => ['set-value', 'mark-as-reviewed'],
            ],
        ]);

        $this->assertSame('set-value', $recommendation['action']);
        $this->assertSame('true', $recommendation['value']);
        $this->assertSame('high', $recommendation['confidence']);
    }

    public function testRejectsGeneratedValuesForReviewOnlyAttributes(): void
    {
        $client = new MockHttpClient(new MockResponse(json_encode([
            'output' => [
                'message' => [
                    'content' => [[
                        'text' => json_encode([
                        'action' => 'set-value',
                        'value' => 'true',
                        'confidence' => 'high',
                        'reason' => 'Generated value.',
                        ]),
                    ]],
                ],
            ],
        ])));
        $service = new BedrockRecommendationService($client);

        $this->expectException(\RuntimeException::class);
        $service->recommend([
            'attribute' => ['name' => 'aria-grabbed'],
            'context' => ['target' => ['tagName' => 'div']],
            'recommendation' => [
                'mode' => 'review',
                'allowedActions' => ['mark-as-reviewed'],
            ],
        ]);
    }

    public function testRejectsAValueOutsideTheSuppliedEvidence(): void
    {
        $client = new MockHttpClient(new MockResponse(json_encode([
            'output' => [
                'message' => [
                    'content' => [[
                        'text' => json_encode([
                            'action' => 'set-value',
                            'value' => 'Invented label',
                            'confidence' => 'high',
                            'reason' => 'Generated from context.',
                        ]),
                    ]],
                ],
            ],
        ])));
        $service = new BedrockRecommendationService($client);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('not supported by the supplied evidence');
        $service->recommend([
            'attribute' => [
                'name' => 'aria-label',
                'allowedValues' => ['Course title'],
            ],
            'context' => [
                'evidence' => [['value' => 'Course title', 'source' => 'visible label']],
            ],
            'recommendation' => [
                'mode' => 'draft',
                'allowedActions' => ['set-value', 'mark-as-reviewed'],
            ],
        ]);
    }
}
